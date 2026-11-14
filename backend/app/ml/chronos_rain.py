"""Bounded zero-shot monthly regional rainfall experiment; never a crop model.

Heavy optional imports occur only in ChronosPredictor, not at API startup.
Backtests use final POWER observations, not historical publication vintages.
"""
from __future__ import annotations

import calendar
import hashlib
import importlib.metadata
import json
import math
from datetime import date, datetime, timezone
from statistics import mean, median
from typing import Callable

from app.schemas.rain_forecast import RainForecastReport, RainQuantiles

MODEL_ID = "amazon/chronos-2"
MODEL_REVISION = "29ec3766d36d6f73f0696f85560a422f50e8498c"
MODEL_PACKAGE_VERSION = "2.3.2"
MIN_CONTEXT_MONTHS = 84
FOLD_MONTHS = 24
MIN_IMPROVEMENT = 0.05


class InsufficientRainHistory(ValueError):
    pass


class ModelUnavailable(RuntimeError):
    pass


def month_number(day: date) -> int:
    return day.year * 12 + day.month - 1


def month_date(number: int) -> date:
    return date(number // 12, number % 12 + 1, 1)


def complete_rain_months(records: list[dict], as_of: date) -> list[dict]:
    """Keep genuinely complete rain months; conflicting duplicate days invalidate one."""
    days: dict[date, float | None] = {}
    cutoff = as_of.replace(day=1)
    for row in records:
        try:
            day = date.fromisoformat(row["date"])
        except (ValueError, TypeError, KeyError):
            continue
        if day >= cutoff:
            continue
        value = row.get("PRECTOTCORR")
        valid = isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0
        value = float(value) if valid else None
        if day in days and days[day] != value:
            days[day] = None
        else:
            days[day] = value
    months = sorted({day.replace(day=1) for day in days})
    result = []
    for month in months:
        values = [days.get(month.replace(day=i)) for i in range(1, calendar.monthrange(month.year, month.month)[1] + 1)]
        if all(v is not None for v in values):
            result.append({"month": month, "total_mm": math.fsum(values)})
    # Gaps must not become adjacent timesteps in a neural model.
    begin = len(result) - 1
    while begin > 0 and month_number(result[begin]["month"]) - month_number(result[begin - 1]["month"]) == 1:
        begin -= 1
    return result[max(0, begin):]


class ChronosPredictor:
    """Fixed public checkpoint. No arbitrary remote model code or cloud service."""
    def __init__(self, *, device: str = "cpu", local_files_only: bool = False):
        try:
            import torch
            from chronos import Chronos2Pipeline
            from huggingface_hub import snapshot_download
            if importlib.metadata.version("chronos-forecasting") != MODEL_PACKAGE_VERSION:
                raise ModelUnavailable(f"Use chronos-forecasting=={MODEL_PACKAGE_VERSION}")
            # Keep inference from exhausting a shared CPU server.
            if device == "cpu":
                torch.set_num_threads(min(4, torch.get_num_threads()))
            checkpoint = snapshot_download(
                repo_id=MODEL_ID, revision=MODEL_REVISION, local_files_only=local_files_only,
                allow_patterns=["config.json", "*.safetensors", "*.safetensors.index.json"],
            )
            # Loading a concrete local snapshot also prevents adapter discovery
            # from making hidden requests against the repository's main branch.
            self.pipeline = Chronos2Pipeline.from_pretrained(
                checkpoint, device_map=device, local_files_only=True,
            )
        except ModelUnavailable:
            raise
        except (ImportError, OSError, ValueError, RuntimeError) as exc:
            raise ModelUnavailable("Chronos-2 is unavailable; install requirements-ml.txt and prepare its weights.") from exc

    def __call__(self, contexts: list[list[float]], prediction_length: int) -> list[list[list[float]]]:
        import numpy as np
        quantiles, _ = self.pipeline.predict_quantiles(
            [np.asarray(values, dtype="float32") for values in contexts],
            prediction_length=prediction_length, quantile_levels=[0.1, 0.5, 0.9],
            batch_size=8, cross_learning=False,
        )
        # Each item is (one target variable, horizon, three quantiles).
        return [q[0].cpu().tolist() for q in quantiles]


def _quantiles(values: list[float]) -> RainQuantiles:
    if len(values) != 3 or any(isinstance(v, bool) or not isinstance(v, (float, int)) or not math.isfinite(v) for v in values):
        raise ValueError("Model returned invalid rainfall quantiles")
    return RainQuantiles(p10_mm=max(0, values[0]), median_mm=max(0, values[1]), p90_mm=max(0, values[2]))


def build_rain_report(
    records: list[dict], latitude: float, longitude: float, as_of: date,
    predictor: Callable, *, retrieved_at: datetime,
) -> RainForecastReport:
    months = complete_rain_months(records, as_of)
    if not months:
        raise InsufficientRainHistory("No complete rainfall months are available.")
    age = month_number(as_of) - month_number(months[-1]["month"])
    if not 1 <= age <= 2:
        raise InsufficientRainHistory("Recent complete rainfall months are missing; no forecast is issued.")
    # Predict the NEXT full month, never mislabel a partly observed current month.
    target = month_date(month_number(as_of) + 1)
    lead = month_number(target) - month_number(months[-1]["month"])
    needed = MIN_CONTEXT_MONTHS + 2 * FOLD_MONTHS + lead - 1
    if len(months) < needed:
        raise InsufficientRainHistory(f"Need {needed} consecutive complete months; found {len(months)}.")
    contexts = []
    references = []
    truth = []
    for index in range(len(months) - 2 * FOLD_MONTHS, len(months)):
        context = months[:index - lead + 1]
        contexts.append([row["total_mm"] for row in context])
        references.append(median(row["total_mm"] for row in context if row["month"].month == months[index]["month"].month))
        truth.append(months[index]["total_mm"])
    contexts.append([row["total_mm"] for row in months])
    outputs = predictor(contexts, lead)
    if len(outputs) != len(contexts) or any(len(output) != lead for output in outputs):
        raise ValueError("Model returned an unexpected forecast shape")
    predictions = [_quantiles(output[-1]) for output in outputs]
    folds = []
    for begin in (0, FOLD_MONTHS):
        end = begin + FOLD_MONTHS
        mae_model = mean(abs(truth[i] - predictions[i].median_mm) for i in range(begin, end))
        mae_ref = mean(abs(truth[i] - references[i]) for i in range(begin, end))
        improvement = (mae_ref - mae_model) / mae_ref if mae_ref > 1e-8 else 0.0
        first = len(months) - 2 * FOLD_MONTHS + begin
        folds.append({
            "from_month": months[first]["month"], "to_month": months[first + FOLD_MONTHS - 1]["month"],
            "examples": FOLD_MONTHS, "mae_model_mm": mae_model, "mae_seasonal_mm": mae_ref,
            "relative_improvement": improvement,
            "empirical_p10_p90_coverage": mean(predictions[i].p10_mm <= truth[i] <= predictions[i].p90_mm for i in range(begin, end)),
        })
    accepted = all(fold["relative_improvement"] >= MIN_IMPROVEMENT for fold in folds)
    digest = hashlib.sha256(json.dumps(records, sort_keys=True, allow_nan=False, separators=(",", ":")).encode()).hexdigest()
    return RainForecastReport(
        issued_at=datetime.now(timezone.utc), as_of=as_of,
        location={"latitude": latitude, "longitude": longitude},
        model={"id": MODEL_ID, "revision": MODEL_REVISION, "package_version": MODEL_PACKAGE_VERSION, "mode": "pretrained_zero_shot"},
        source={"url": "https://power.larc.nasa.gov/api/temporal/daily/point", "representation": "Regional gridded estimate; not an in-situ parcel measurement",
                "records_sha256": digest, "first_month": months[0]["month"], "last_month": months[-1]["month"],
                "complete_months": len(months), "retrieved_at": retrieved_at},
        target_month=target, prediction=predictions[-1],
        seasonal_reference_mm=median(row["total_mm"] for row in months if row["month"].month == target.month),
        clipped_negative_quantiles=sum(v < 0 for output in outputs for v in output[-1]),
        evaluation={"status": "beat_seasonal_reference" if accepted else "did_not_beat_seasonal_reference",
                    "folds": folds, "minimum_improvement_per_fold": MIN_IMPROVEMENT, "lead_months": lead,
                    "data_vintages": "retrospective_final_data_not_archived_vintages"},
        history=months[-12:],
        limitations=[
            "Predicción experimental regional de lluvia; no mide lluvia ni agua disponible en una parcela.",
            "Los cuantiles 10–90 del modelo no son un intervalo calibrado localmente.",
            "La evaluación es retrospectiva con datos finales NASA; no reconstruye sus fechas históricas de publicación ni descarta solapamiento con el preentrenamiento.",
            "No hay validación independiente de campo o transferencia geográfica; no determina aptitud, cosecha ni riego.",
            "Los cuantiles negativos de precipitación se recortan a cero; el recorte queda registrado.",
        ],
    )
