"""Synthetic fixtures validate software contracts, not NASA or agronomic accuracy."""
import calendar
import json
import os
import sys
import tempfile
import unittest
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from fastapi.testclient import TestClient
from pydantic import ValidationError
from app.main import app
from app.api import agro_routes
from app.connectors.nasa_power import NasaPowerError
from app.ml.chronos_rain import ChronosPredictor, InsufficientRainHistory, ModelUnavailable, MODEL_ID, MODEL_REVISION, build_rain_report, complete_rain_months, month_date, month_number
from app.schemas.rain_forecast import ForecastRequest, RainForecastReport
from app.services.rain_forecast import cached_report, fetch_rain_history, report_key, save_report

AS_OF = date(2026, 11, 14)
RETRIEVED = datetime(2026, 11, 14, tzinfo=timezone.utc)
LOCATION = ForecastRequest(latitude=-13.32175, longitude=-71.95605)


def rainfall_records():
    records = []
    for offset in range(180):
        month = month_date(month_number(date(2011, 11, 1)) + offset)
        days = calendar.monthrange(month.year, month.month)[1]
        records.extend({"date": month.replace(day=day).isoformat(), "PRECTOTCORR": (offset + 1) / days} for day in range(1, days + 1))
    return records


class RecordingPredictor:
    def __init__(self):
        self.contexts = []
        self.lead = None

    def __call__(self, contexts, lead):
        self.contexts = contexts
        self.lead = lead
        return [[[10.0, 20.0, 30.0] for _ in range(lead)] for _ in contexts]


def fixture_report():
    return build_rain_report(rainfall_records(), LOCATION.latitude, LOCATION.longitude, AS_OF, RecordingPredictor(), retrieved_at=RETRIEVED)


class RainPipelineTests(unittest.TestCase):
    def test_runtime_resolves_pinned_local_snapshot_before_loading_pipeline(self):
        download = MagicMock(return_value="/tmp/test-pinned-chronos-snapshot")
        load = MagicMock()
        modules = {
            "torch": SimpleNamespace(get_num_threads=lambda: 8, set_num_threads=MagicMock()),
            "chronos": SimpleNamespace(Chronos2Pipeline=SimpleNamespace(from_pretrained=load)),
            "huggingface_hub": SimpleNamespace(snapshot_download=download),
        }
        with patch.dict(sys.modules, modules), patch("app.ml.chronos_rain.importlib.metadata.version", return_value="2.3.2"):
            ChronosPredictor(local_files_only=True)
        self.assertEqual(download.call_args.kwargs["repo_id"], MODEL_ID)
        self.assertEqual(download.call_args.kwargs["revision"], MODEL_REVISION)
        self.assertTrue(download.call_args.kwargs["local_files_only"])
        load.assert_called_once_with("/tmp/test-pinned-chronos-snapshot", device_map="cpu", local_files_only=True)

    def test_zero_rain_is_valid_and_leap_day_is_required(self):
        rows = [{"date": f"2024-02-{day:02d}", "PRECTOTCORR": 0} for day in range(1, 30)]
        self.assertEqual(complete_rain_months(rows, AS_OF)[0]["total_mm"], 0)
        self.assertEqual(complete_rain_months(rows[:-1], AS_OF), [])

    def test_missing_boolean_and_conflicting_duplicates_are_not_observations(self):
        for bad in (None, True, -999, float("inf")):
            rows = [{"date": f"2026-10-{day:02d}", "PRECTOTCORR": 1} for day in range(1, 32)]
            rows[0]["PRECTOTCORR"] = bad
            self.assertEqual(complete_rain_months(rows, AS_OF), [])
        rows = [{"date": f"2026-10-{day:02d}", "PRECTOTCORR": 1} for day in range(1, 32)]
        rows.append({"date": "2026-10-01", "PRECTOTCORR": 2})
        self.assertEqual(complete_rain_months(rows, AS_OF), [])

    def test_next_full_month_and_backtest_leads_do_not_leak(self):
        predictor = RecordingPredictor()
        rows = rainfall_records() + [{"date": "2026-11-01", "PRECTOTCORR": 999999}]
        report = build_rain_report(rows, LOCATION.latitude, LOCATION.longitude, AS_OF, predictor, retrieved_at=RETRIEVED)
        self.assertEqual(report.target_month, date(2026, 12, 1))
        self.assertEqual(predictor.lead, 2)
        self.assertEqual(len(predictor.contexts), 49)
        self.assertAlmostEqual(predictor.contexts[0][-1], 131)
        self.assertAlmostEqual(predictor.contexts[-1][-1], 180)
        self.assertEqual([f.examples for f in report.evaluation.folds], [24, 24])
        self.assertFalse(report.used_in_crop_decision)
        self.assertFalse(report.model.fine_tuned)

    def test_december_emission_forecasts_january_of_next_year(self):
        report = build_rain_report(rainfall_records(), LOCATION.latitude, LOCATION.longitude, date(2026, 12, 14), RecordingPredictor(), retrieved_at=RETRIEVED)
        self.assertEqual(report.target_month, date(2027, 1, 1))
        self.assertEqual(report.evaluation.lead_months, 3)

    def test_gap_is_not_compressed_and_short_history_never_loads_model(self):
        predictor = RecordingPredictor()
        rows = [r for r in rainfall_records() if r["date"] != "2020-01-15"]
        with self.assertRaises(InsufficientRainHistory):
            build_rain_report(rows, LOCATION.latitude, LOCATION.longitude, AS_OF, predictor, retrieved_at=RETRIEVED)
        self.assertEqual(predictor.contexts, [])

    def test_stale_context_is_withheld(self):
        rows = [r for r in rainfall_records() if r["date"] < "2026-09-01"]
        with self.assertRaises(InsufficientRainHistory):
            build_rain_report(rows, LOCATION.latitude, LOCATION.longitude, AS_OF, RecordingPredictor(), retrieved_at=RETRIEVED)

    def test_invalid_quantiles_cannot_be_exported_as_predictions(self):
        def crossed(contexts, lead):
            return [[[30.0, 20.0, 10.0] for _ in range(lead)] for _ in contexts]
        with self.assertRaises(ValidationError):
            build_rain_report(rainfall_records(), LOCATION.latitude, LOCATION.longitude, AS_OF, crossed, retrieved_at=RETRIEVED)

    def test_seasonal_reference_uses_only_each_origin_past(self):
        report = fixture_report()
        # Targets Nov 2022..Oct 2024: the matching seasonal medians must
        # exclude each target and the month directly before it at lead=2.
        months = complete_rain_months(rainfall_records(), AS_OF)
        errors = []
        from statistics import median
        for index in range(132, 156):
            past = months[:index - 1]
            ref = median(r["total_mm"] for r in past if r["month"].month == months[index]["month"].month)
            errors.append(abs(months[index]["total_mm"] - ref))
        self.assertAlmostEqual(report.evaluation.folds[0].mae_seasonal_mm, sum(errors) / len(errors))


class RainArtifactsAndAPITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.report = fixture_report()

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.directory = Path(self.tmp.name)
        self.env = patch.dict(os.environ, {"RAIN_FORECAST_REPORT_DIR": str(self.directory), "CHRONOS_INFERENCE_ENABLED": "false"})
        self.env.start(); self.addCleanup(self.env.stop)
        self.bundle = patch("app.services.rain_forecast.BUNDLED_REPORTS", self.directory / "bundled")
        self.bundle.start(); self.addCleanup(self.bundle.stop)
        self.client = TestClient(app)

    def test_unprepared_api_does_not_call_nasa_or_load_a_model(self):
        with patch.object(agro_routes, "fetch_rain_history", new_callable=AsyncMock) as nasa, patch.object(agro_routes, "_predict") as model:
            response = self.client.post("/api/agro/rain-forecast", json=LOCATION.model_dump())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "not_prepared")
        self.assertIsNone(response.json()["report"])
        nasa.assert_not_awaited(); model.assert_not_called()

    def test_pilot_has_exactly_four_crops_and_no_field_claim(self):
        result = self.client.get("/api/agro/pilot").json()
        self.assertEqual([c["id"] for c in result["crops"]], ["maize", "potato", "faba", "barley"])
        self.assertFalse(result["field_records_available"])
        self.assertFalse(result["live_inference_enabled"])

    def test_coordinates_are_required_finite_and_no_model_paths_are_accepted(self):
        for payload in ({}, {"latitude": 91, "longitude": 0}, {**LOCATION.model_dump(), "model": "/tmp/untrusted"}):
            self.assertEqual(self.client.post("/api/agro/rain-forecast", json=payload).status_code, 422)

    def test_exact_location_artifact_staleness_and_schema_validation(self):
        path = save_report(self.report)
        self.assertTrue(path.exists())
        self.assertEqual(cached_report(LOCATION, AS_OF)[0], "available")
        self.assertEqual(cached_report(LOCATION, AS_OF + timedelta(days=8))[0], "stale_report")
        self.assertEqual(cached_report(LOCATION, date(2026, 12, 1))[0], "stale_report")
        self.assertEqual(cached_report(ForecastRequest(latitude=-13.33, longitude=-71.96), AS_OF)[0], "not_prepared")
        payload = self.report.model_dump(mode="json")
        payload["prediction"]["median_mm"] = -100
        path.write_text(json.dumps(payload))
        self.assertEqual(cached_report(LOCATION, AS_OF)[0], "invalid_report")

    def test_prepared_api_returns_real_artifact_without_inference(self):
        save_report(self.report)
        with patch.object(agro_routes, "cached_report", return_value=("available", self.report)), patch.object(agro_routes, "_predict") as predictor:
            result = self.client.post("/api/agro/rain-forecast", json=LOCATION.model_dump()).json()
        self.assertEqual(result["delivery"], "prepared_report")
        self.assertEqual(result["report"]["model"]["id"], "amazon/chronos-2")
        predictor.assert_not_called()

    def test_model_failure_releases_inference_slot_and_does_not_fabricate_result(self):
        with patch.dict(os.environ, {"CHRONOS_INFERENCE_ENABLED": "true"}), patch.object(agro_routes, "fetch_rain_history", new_callable=AsyncMock, return_value=([], RETRIEVED)), patch.object(agro_routes, "compute_report", side_effect=ModelUnavailable("test only")):
            for _ in range(2):
                result = self.client.post("/api/agro/rain-forecast", json=LOCATION.model_dump())
                self.assertEqual(result.json()["status"], "model_unavailable")
                self.assertIsNone(result.json()["report"])

    def test_busy_runtime_rejects_additional_requests(self):
        agro_routes._inference_lock.acquire()
        try:
            with patch.dict(os.environ, {"CHRONOS_INFERENCE_ENABLED": "true"}):
                response = self.client.post("/api/agro/rain-forecast", json=LOCATION.model_dump())
            self.assertEqual(response.status_code, 429)
        finally:
            agro_routes._inference_lock.release()

    def test_history_is_reused_without_duplicate_provider_requests(self):
        async def nasa(latitude, longitude, start, end, timeout):
            data = {(start + timedelta(days=i)).strftime("%Y%m%d"): 1.0 for i in range((end - start).days + 1)}
            return {"properties": {"parameter": {"PRECTOTCORR": data}}}
        async def run():
            first, _ = await fetch_rain_history(LOCATION, AS_OF, self.directory / "history")
            second, _ = await fetch_rain_history(LOCATION, AS_OF, self.directory / "history")
            self.assertEqual(first, second)
        import asyncio
        with patch("app.services.rain_forecast.fetch_daily_point", new_callable=AsyncMock, side_effect=nasa) as provider:
            asyncio.run(run())
            self.assertEqual(provider.await_count, 16)

    def test_provider_failure_drains_other_downloads_before_returning(self):
        import asyncio
        in_flight = 0
        peak = 0

        async def nasa(latitude, longitude, start, end, timeout):
            nonlocal in_flight, peak
            in_flight += 1
            peak = max(peak, in_flight)
            try:
                if start.year == 2011:
                    await asyncio.sleep(0)
                    raise NasaPowerError("Test provider unavailable")
                await asyncio.Event().wait()
            finally:
                in_flight -= 1

        async def run():
            with self.assertRaises(NasaPowerError):
                await fetch_rain_history(LOCATION, AS_OF, self.directory / "failure-history")
            self.assertEqual(in_flight, 0)
            self.assertLessEqual(peak, 2)

        with patch("app.services.rain_forecast.fetch_daily_point", new_callable=AsyncMock, side_effect=nasa):
            asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
