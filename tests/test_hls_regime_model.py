"""Real NASA HLS model: reproducing training, held-out 2026 and decision effects."""
from __future__ import annotations
import json
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from app.main import app
from app.services import hls_regime_model as H
from app.services import rotation_engine as E

ROOT = Path(__file__).resolve().parents[1]


class TrainedHLSModelTests(unittest.TestCase):
    def test_published_model_is_reproducible_from_original_nasa_hls_records(self):
        expected = json.loads(H.MODEL_FILE.read_text(encoding="utf-8"))
        fresh = H.train_model()
        self.assertTrue(H.same_model(expected, fresh))
        self.assertEqual(fresh["status"], "trained_unsupervised_nasa_hls")
        self.assertEqual(fresh["validation"]["training_example_polygons"], 4)
        self.assertGreaterEqual(fresh["validation"]["train_month_observations"], 150)
        self.assertGreaterEqual(fresh["validation"]["holdout_2026_observations"], 30)
        self.assertGreater(fresh["validation"]["holdout_distortion_reduction_vs_one_centroid"], .15)
        self.assertFalse(fresh["validation"]["independent_farmer_validation"])
        self.assertEqual(len(fresh["sources"]), 4)
        self.assertTrue(all(s["git_blob_sha"] for s in fresh["sources"]))

    def test_barranca_field_uses_real_observed_months_without_imputation(self):
        history = next(json.loads(p.read_text(encoding="utf-8"))
                       for p in H.SEED_DIR.glob("*.json")
                       if json.loads(p.read_text(encoding="utf-8")).get("example_field_id") == "barranca-1")
        result = H.assess_field(history)
        self.assertEqual(result["status"], "available")
        self.assertGreaterEqual(result["field_months_observed"], 12)
        self.assertEqual(result["field_months_observed"], len(result["regimes"]))
        self.assertEqual(result["low_vegetation_months"],
                         sum(s["state"] == "vegetacion_baja" for s in result["regimes"]))
        self.assertGreaterEqual(result["cover_priority_multiplier"], 1)
        self.assertLessEqual(result["cover_priority_multiplier"], 1.6)
        self.assertFalse(result["has_ground_truth_crops"])
        self.assertTrue(all(m["month"] >= "2024-12" for m in result["regimes"]))

    def test_missing_or_other_sensor_never_creates_fake_inference(self):
        self.assertEqual(H.assess_field(None)["status"], "unavailable")
        self.assertEqual(H.assess_field({"sensor": "ESA Sentinel-2", "months": []})["status"], "unavailable")
        self.assertEqual(H.assess_field({"sensor": "NASA HLS v2.0", "months": []})["status"],
                         "insufficient_field_observations")

    def test_AI_can_change_ranking_when_soil_priority_is_relevant(self):
        plans = [
            {"id": "S0", "indicators": {"water_low_river_mm": 300, "bare_months": 12}},
            {"id": "S1", "indicators": {"water_low_river_mm": 200, "bare_months": 12}},
            {"id": "S2", "indicators": {"water_low_river_mm": 300, "bare_months": 9}},
        ]
        priorities = {"water": 1, "soil": 1, "pests": 0}
        normal = E.highlight_for_farmer(plans, priorities, "normal")
        informed = E.highlight_for_farmer(plans, priorities, "normal", {
            "status": "available", "model_version": H.MODEL_VERSION,
            "cover_priority_multiplier": 1.5})
        self.assertEqual(normal["recommended_strategy_id"], "S1")
        self.assertEqual(informed["recommended_strategy_id"], "S2")
        self.assertTrue(informed["ai_influenced_ranking"])

    def test_AI_cannot_justify_more_water_when_farmer_has_scarce_irrigation(self):
        plans = [
            {"id": "S0", "indicators": {"water_low_river_mm": 300, "bare_months": 12}},
            {"id": "S2", "indicators": {"water_low_river_mm": 320, "bare_months": 0}},
        ]
        chosen = E.highlight_for_farmer(plans, {"water": 0, "soil": 2}, "escaso", {
            "status": "available", "model_version": H.MODEL_VERSION,
            "cover_priority_multiplier": 1.6})
        self.assertIsNone(chosen["recommended_strategy_id"])

    def test_public_model_metadata_never_claims_crop_predictive_accuracy(self):
        response = TestClient(app).get("/api/rotation/ai-model")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["version"], H.MODEL_VERSION)
        self.assertIn("not_crop_or_yield_prediction", response.json()["training_task"])
        self.assertFalse(response.json()["validation"]["independent_farmer_validation"])

    def test_demo_compare_attaches_model_only_to_exact_selected_field(self):
        fields = json.loads((ROOT/"frontend"/"src"/"exampleFields.json").read_text(encoding="utf-8"))
        example = next(p for p in fields["team_fields"] if p["id"] == "barranca-1")
        from tests.test_rotation import coastal_climate

        async def fake_monthly_climate(lat, lon, client=None, coastal=True):
            return coastal_climate()

        body = {
            "zone": "barranca", "latitude": -10.699, "longitude": -77.739,
            "current": E.TEMPLATES["current"], "priorities": {"water": 1, "soil": 1},
            "field_polygon": example["polygon"], "water_turn": "no_se",
        }
        with patch("app.api.rotation_routes.monthly_climate", fake_monthly_climate):
            result = TestClient(app).post("/api/rotation/compare", json=body)
        self.assertEqual(result.status_code, 200, result.text)
        response = result.json()
        self.assertEqual(response["ai_analysis"]["status"], "available")
        self.assertEqual(response["ai_analysis"]["model_version"], H.MODEL_VERSION)
        self.assertIn("without_ai_strategy_id", response["ai_decision_impact"])
        self.assertIn("with_ai_strategy_id", response["ai_decision_impact"])


if __name__ == "__main__":
    unittest.main()
