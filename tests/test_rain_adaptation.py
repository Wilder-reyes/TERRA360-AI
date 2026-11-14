"""Independent synthetic fixtures for chronology, selection and public contracts."""
import asyncio
import json
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from fastapi.testclient import TestClient
from pydantic import ValidationError
from app.main import app
from app.ml.chronos_rain import complete_rain_months, MODEL_ID, MODEL_REVISION
from app.ml.rain_adaptation import ADAPTATION_CONFIG, best_development_candidate, chronological_split, evaluation_windows, publish_adaptation, score_outputs, select_on_validation, validation_sequences
from app.schemas.rain_experiment import RainExperimentReport
from app.services.rain_forecast import cached_experiment, fetch_rain_history, report_key
from test_chronos_rain import AS_OF, LOCATION, rainfall_records, fixture_report


def experiment_fixture():
    score = {"examples": 24, "mae_mm": 20.0, "seasonal_mae_mm": 21.0, "p10_p90_coverage": 0.75}
    adapted = {**score, "mae_mm": 19.99}
    return {
        "schema_version": 1, "experiment_id": "a" * 64, "candidate_experiment_id": "b" * 64,
        "records_sha256": "c" * 64, "created_at": "2026-11-14T17:00:00Z", "as_of": "2026-11-14",
        "location": LOCATION.model_dump(), "model_id": MODEL_ID, "model_revision": MODEL_REVISION,
        "history_months": 180, "training_months": 106, "independent_series": 1, "lead_months": 2,
        "dates": {"train_from": "2011-11-01", "train_to": "2020-08-01", "validation_from": "2020-10-01", "validation_to": "2022-09-01", "test_from": "2022-11-01", "test_to": "2026-10-01"},
        "configuration": dict(ADAPTATION_CONFIG), "adapter_sha256": "d" * 64,
        "trainable_parameters": 4, "total_parameters": 10, "packages": {"fixture": "synthetic"},
        "validation": {"selected": "original", "chosen_using": "development_validation_only", "original": score, "lora": adapted},
        "test_folds": [
            {"from_month": "2022-11-01", "to_month": "2024-10-01", "original": score, "lora": adapted, "seasonal_mae_mm": 21.0},
            {"from_month": "2024-11-01", "to_month": "2026-10-01", "original": score, "lora": adapted, "seasonal_mae_mm": 21.0}],
        "test_previously_examined": True, "eligible_for_publication": False, "published": False,
        "candidates": [{"experiment_id": char * 64, "learning_rate": lr, "steps": steps, "validation_mae_mm": error}
                       for char, lr, steps, error in [("b", 1e-5, 60, 19.99), ("c", 1e-4, 120, 20.1), ("d", 1e-3, 120, 21.0)]],
        "limitations": ["Synthetic contract fixture; not model performance."]}


class AdaptationProtocolTests(unittest.TestCase):
    def setUp(self):
        self.months = complete_rain_months(rainfall_records(), AS_OF)

    def test_embargo_keeps_selection_before_first_test_context(self):
        for lead in (2, 3):
            split = chronological_split(self.months, lead)
            self.assertEqual(split["validation_stop"] - split["validation_start"], 24)
            self.assertEqual(split["test_stop"] - split["test_start"], 48)
            self.assertEqual(split["train_stop"], split["validation_start"] - lead + 1)
            self.assertEqual(split["validation_stop"], split["test_start"] - lead + 1)
            self.assertLess(split["train_stop"] - 1, split["validation_start"])

    def test_training_and_validation_targets_never_include_test(self):
        split = chronological_split(self.months, 2)
        sequences = validation_sequences(self.months, split, 96)
        self.assertEqual(len(sequences), 24)
        self.assertAlmostEqual(sequences[-1][-1], self.months[split["validation_stop"] - 1]["total_mm"])
        self.assertTrue(all(len(seq) <= 98 for seq in sequences))
        contexts, truth, refs = evaluation_windows(self.months, split["test_start"], split["test_stop"], 2)
        self.assertEqual(len(contexts), 48)
        self.assertEqual(len(refs), 48)
        self.assertNotEqual(contexts[0][-1], truth[0])

    def test_gaps_and_short_history_fail_closed(self):
        with self.assertRaises(ValueError): chronological_split(self.months[:100], 2)
        with self.assertRaises(ValueError): chronological_split(self.months[:90] + self.months[91:], 2)
        with self.assertRaises(ValueError): chronological_split(self.months, 0)

    def test_selection_is_based_on_validation_even_if_test_looks_better(self):
        candidates = [
            {"experiment_id": "a", "validation": {"lora": {"mae_mm": 20}}, "test_mae": 1},
            {"experiment_id": "b", "validation": {"lora": {"mae_mm": 18}}, "test_mae": 100}]
        self.assertEqual(best_development_candidate(candidates)["experiment_id"], "b")
        self.assertEqual(select_on_validation({"examples": 24, "mae_mm": 20}, {"examples": 24, "mae_mm": 19.1}), "original")
        self.assertEqual(select_on_validation({"examples": 24, "mae_mm": 20}, {"examples": 24, "mae_mm": 18}), "lora")
        self.assertEqual(select_on_validation({"examples": 24, "mae_mm": 0}, {"examples": 24, "mae_mm": 0}), "original")

    def test_a_test_gate_cannot_promote_a_rejected_validation_candidate(self):
        folds = [{"lora": {"mae_mm": 5}, "original": {"mae_mm": 10}, "seasonal_mae_mm": 10}] * 2
        self.assertFalse(publish_adaptation("original", folds))
        self.assertTrue(publish_adaptation("lora", folds))
        folds[0] = {"lora": {"mae_mm": 9.9}, "original": {"mae_mm": 10}, "seasonal_mae_mm": 10}
        self.assertFalse(publish_adaptation("lora", folds))
        self.assertFalse(publish_adaptation("lora", [{"lora": {"mae_mm": 0}, "original": {"mae_mm": 1}, "seasonal_mae_mm": 0}] * 2))

    def test_experiment_metrics_reject_invalid_shapes_and_quantiles(self):
        with self.assertRaises(ValueError): score_outputs([], [10], [9], 2)
        with self.assertRaises(ValueError): score_outputs([[[0, float("nan"), 20]]], [10], [9], 1)


class AdaptationPublicContractTests(unittest.TestCase):
    def test_report_preserves_original_and_discloses_previously_examined_test(self):
        report = RainExperimentReport.model_validate(experiment_fixture())
        self.assertFalse(report.published)
        self.assertTrue(report.test_previously_examined)

    def test_selection_cannot_use_dates_unavailable_at_first_test_origin(self):
        payload = experiment_fixture()
        payload["dates"]["validation_to"] = "2022-10-01"
        with self.assertRaises(ValidationError): RainExperimentReport.model_validate(payload)

    def test_false_success_and_nonfinite_metrics_are_rejected(self):
        for field, value in (("eligible_for_publication", True), ("published", True)):
            payload = experiment_fixture(); payload[field] = value
            with self.assertRaises(ValidationError): RainExperimentReport.model_validate(payload)
        payload = experiment_fixture(); payload["validation"]["lora"]["mae_mm"] = float("nan")
        with self.assertRaises(ValidationError): RainExperimentReport.model_validate(payload)

    def test_different_reference_or_wrong_selected_adapter_are_rejected(self):
        payload = experiment_fixture(); payload["test_folds"][0]["seasonal_mae_mm"] = 10
        with self.assertRaises(ValidationError): RainExperimentReport.model_validate(payload)
        payload = experiment_fixture(); payload["candidate_experiment_id"] = "f" * 64
        with self.assertRaises(ValidationError): RainExperimentReport.model_validate(payload)

    def test_comparison_cannot_be_reused_for_other_location_or_data_cutoff(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / report_key(LOCATION)
            path.write_text(json.dumps(experiment_fixture()))
            with patch("app.services.rain_forecast.BUNDLED_EXPERIMENTS", Path(directory)):
                self.assertIsNotNone(cached_experiment(LOCATION, AS_OF, date(2026, 10, 1)))
                self.assertIsNone(cached_experiment(LOCATION, AS_OF, date(2026, 9, 1)))
                self.assertIsNone(cached_experiment(LOCATION, date(2026, 11, 1), date(2026, 10, 1)))
                path.write_text('{}')
                self.assertIsNone(cached_experiment(LOCATION, AS_OF, date(2026, 10, 1)))

    def test_api_adds_optional_comparison_without_loading_weights(self):
        client = TestClient(app)
        report = fixture_report()
        with patch("app.api.agro_routes.cached_report", return_value=("available", report)), patch("app.api.agro_routes.cached_experiment", return_value=experiment_fixture()), patch("app.api.agro_routes._predict") as model:
            response = client.post("/api/agro/rain-forecast", json=LOCATION.model_dump())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["experiment"]["validation"]["selected"], "original")
        self.assertFalse(response.json()["report"]["model"]["fine_tuned"])
        model.assert_not_called()

    def test_invalid_history_years_never_fetch_nasa(self):
        async def run():
            with patch("app.services.rain_forecast.fetch_daily_point", new_callable=AsyncMock) as source:
                for years in (1, 36, True, 15.5):
                    with self.assertRaises(ValueError): await fetch_rain_history(LOCATION, AS_OF, years=years)
                source.assert_not_awaited()
        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
