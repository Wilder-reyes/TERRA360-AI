"""NASA/FAO crop exploration: no fictitious yields, rankings or local sowing advice."""
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient

from app.main import app
from app.services.farmer_crop_guidance import (
    build_crop_guidance, climate_summary, reliable_reference_range, screen_crop,
)

GOOD = [
    {"year": year, "status": "complete", "precipitation_total_mm": 24.0 + year % 3,
     "temperature_mean_c": 19.0 + year % 2}
    for year in range(2021, 2026)
]


class CropGuidanceTests(unittest.TestCase):
    def test_never_recommends_or_ranks_any_sowing_even_when_climate_matches(self):
        r = build_crop_guidance(GOOD, "sweet_potato")
        self.assertFalse(r["can_recommend_sowing"])
        self.assertFalse(r["locally_validated"])
        self.assertTrue(r["regional_climate_only"])
        self.assertIsNotNone(r["selected_crop"])
        self.assertFalse(r["selected_crop"]["can_recommend_sowing"])
        self.assertIsNone(r["selected_crop"].get("yield_prediction"))
        self.assertTrue(all(not x["local_suitability_confirmed"] for x in r["candidates"]))

    def test_incomplete_years_abstain_instead_of_dividing_incomplete_totals(self):
        rows = [{**GOOD[i], "status": "partial"} for i in range(3)] + GOOD[3:5]
        r = build_crop_guidance(rows, "tomato")
        self.assertEqual(r["status"], "insufficient_data")
        self.assertIsNone(r["climate"]["annual_rain_mm"])
        self.assertEqual(r["selected_crop"]["status"], "insufficient_evidence")

    def test_invalid_or_missing_fao_values_never_pass(self):
        self.assertIsNone(reliable_reference_range(
            {"topmn": True, "topmx": 25}, "topmn", "topmx", -40, 65
        ))
        self.assertIsNone(reliable_reference_range(
            {"topmn": 50, "topmx": 10}, "topmn", "topmx", -40, 65
        ))
        self.assertIsNone(reliable_reference_range(
            {"topmn": 99, "topmx": 130}, "topmn", "topmx", -40, 65
        ))

    def test_climate_comparison_does_not_treat_rain_as_irrigation_supply(self):
        with patch("app.services.farmer_crop_guidance.fao_by_species",
                   return_value={"ipomoea batatas": {
                       "topmn": 12, "topmx": 32, "ropmn": 500, "ropmx": 1700,
                   }}):
            result = screen_crop("sweet_potato", climate_summary(GOOD))
        self.assertEqual(result["temperature_review"], "within_expert_reference")
        self.assertEqual(result["rain_review"], "below_expert_reference")
        self.assertIn("riego", result["reason"])
        self.assertFalse(result["can_recommend_sowing"])

    def test_endpoint_rejects_unknown_crop_before_nasa_calls(self):
        r = TestClient(app).get("/api/arie/crop-guidance", params={
            "latitude": -11.479, "longitude": -77.180, "selected_crop": "imaginary",
        })
        self.assertEqual(r.status_code, 422)

    def test_endpoint_uses_canonical_history_records(self):
        fake = {
            "source": "NASA POWER", "location": {"name": "Punto elegido"},
            "period": {"start_year": 2021, "end_year": 2025},
            "records": GOOD,
        }
        with patch("app.api.history_routes.history", return_value=fake):
            r = TestClient(app).get("/api/arie/crop-guidance", params={
                "latitude": -11.479, "longitude": -77.180, "selected_crop": "tomato",
            })
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["source"], "NASA POWER")
        self.assertEqual(len(r.json()["history"]), 5)
        self.assertFalse(r.json()["can_recommend_sowing"])


if __name__ == "__main__":
    unittest.main()
