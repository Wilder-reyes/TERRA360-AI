"""Cached forecast artifacts and explicitly enabled, bounded local inference."""
from __future__ import annotations

import asyncio
import hashlib
import json
import os
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from tempfile import NamedTemporaryFile

from pydantic import ValidationError

from app.connectors.nasa_power import fetch_daily_point, normalize_daily
from app.ml.chronos_rain import build_rain_report, month_date, month_number
from app.schemas.rain_forecast import ForecastRequest, RainForecastReport
from app.schemas.rain_experiment import RainExperimentReport

BACKEND = Path(__file__).resolve().parents[2]
BUNDLED_REPORTS = Path(__file__).resolve().parents[1] / "data" / "rain_forecasts"
BUNDLED_EXPERIMENTS = Path(__file__).resolve().parents[1] / "data" / "rain_experiments"


def report_key(location: ForecastRequest) -> str:
    return hashlib.sha256(f"{location.latitude:.6f},{location.longitude:.6f}".encode()).hexdigest()[:24] + ".json"


def report_directory() -> Path:
    return Path(os.getenv("RAIN_FORECAST_REPORT_DIR", str(BACKEND / "models" / "rain_forecasts")))


def atomic_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, suffix=".tmp", delete=False) as handle:
            temporary = Path(handle.name)
            json.dump(payload, handle, ensure_ascii=False, indent=2, allow_nan=False)
            handle.write("\n")
        temporary.replace(path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def save_report(report: RainForecastReport, directory: Path | None = None) -> Path:
    path = (directory if directory is not None else report_directory()) / report_key(report.location)
    atomic_json(path, report.model_dump(mode="json"))
    return path


def cached_report(location: ForecastRequest, today: date) -> tuple[str, RainForecastReport | None]:
    for directory in (report_directory(), BUNDLED_REPORTS):
        path = directory / report_key(location)
        if not path.exists():
            continue
        try:
            report = RainForecastReport.model_validate_json(path.read_text(encoding="utf-8"))
        except (OSError, ValueError, ValidationError):
            return "invalid_report", None
        if abs(report.location.latitude - location.latitude) > 1e-6 or abs(report.location.longitude - location.longitude) > 1e-6:
            return "invalid_report", None
        target = month_date(month_number(today) + 1)
        if report.target_month != target or not 0 <= (today - report.as_of).days <= 7:
            return "stale_report", None
        return "available", report
    return "not_prepared", None


def cached_experiment(location: ForecastRequest, today: date, last_month: date) -> dict | None:
    """Historical comparison only for the same location and data cutoff as the forecast."""
    path = BUNDLED_EXPERIMENTS / report_key(location)
    try:
        study = RainExperimentReport.model_validate_json(path.read_text(encoding="utf-8"))
    except (OSError, ValueError, ValidationError):
        return None
    if (abs(study.location.latitude - location.latitude) > 1e-6
            or abs(study.location.longitude - location.longitude) > 1e-6
            or study.as_of > today or study.dates.test_to != last_month):
        return None
    return study.model_dump(mode="json")


async def fetch_rain_history(location: ForecastRequest, today: date, cache_dir: Path | None = None, *, years: int = 15) -> tuple[list[dict], datetime]:
    """Bounded history, max two requests at once; caches completed annual slices."""
    if isinstance(years, bool) or not isinstance(years, int) or not 15 <= years <= 35:
        raise ValueError("Use 15 to 35 complete years of history")
    cache_dir = cache_dir or BACKEND / "data" / "chronos_power"
    end = today.replace(day=1) - timedelta(days=1)
    start = month_date(month_number(end) - years * 12 + 1)
    semaphore = asyncio.Semaphore(2)

    async def annual(year: int):
        first, last = max(start, date(year, 1, 1)), min(end, date(year, 12, 31))
        suffix = f"{location.latitude:.6f},{location.longitude:.6f},{first},{last}"
        path = cache_dir / (hashlib.sha256(suffix.encode()).hexdigest() + ".json")
        if path.exists():
            try:
                payload = json.loads(path.read_text())
                return payload["records"], datetime.fromisoformat(payload["retrieved_at"])
            except (ValueError, KeyError, OSError, TypeError):
                pass
        async with semaphore:
            raw = await fetch_daily_point(location.latitude, location.longitude, first, last, timeout=45)
        records = normalize_daily(raw, first, last)["records"]
        retrieved = datetime.now(timezone.utc)
        # Only cache slices whose rain is complete; a provider lag must recover.
        if all(row["PRECTOTCORR"] is not None and row["PRECTOTCORR"] >= 0 for row in records):
            atomic_json(path, {"retrieved_at": retrieved.isoformat(), "records": records})
        return records, retrieved

    tasks = [asyncio.create_task(annual(year)) for year in range(start.year, end.year + 1)]
    try:
        values = await asyncio.gather(*tasks)
    except BaseException:
        # gather alone leaves sibling downloads alive after the first failure.
        # Drain them before releasing the API's single-inference slot.
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        raise
    return [row for records, _ in values for row in records], max(retrieved for _, retrieved in values)


def compute_report(records: list[dict], location: ForecastRequest, today: date, retrieved_at: datetime, predictor) -> RainForecastReport:
    return build_rain_report(records, location.latitude, location.longitude, today, predictor, retrieved_at=retrieved_at)
