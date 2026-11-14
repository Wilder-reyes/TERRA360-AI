"""NASA/FAO crop exploration: no fictitious yields, rankings or local sowing advice."""
import unittest
from unittest.mock import patch
from datetime import date, timedelta
from fastapi.testclient import TestClient

from app.main import app
from app.services.farmer_crop_guidance import (
    build_crop_guidance, climate_summary, reliable_reference_range, screen_crop,
    annual_summaries_from_daily,
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

    def test_endpoint_uses_one_nasa_request_and_complete_years(self):
        last_year = date.today().year - 1
        first_year = last_year - 4
        start, end = date(first_year, 1, 1), date(last_year, 12, 31)
        rows = []
        day = start
        while day <= end:
            rows.append({"date": day.isoformat(), "PRECTOTCORR": .05, "T2M": 20.0})
            day += timedelta(days=1)
        with patch("app.connectors.nasa_power.fetch_daily_point",
                   return_value={"fake": "NASA only in test"}) as fetch, \
             patch("app.connectors.nasa_power.normalize_daily",
                   return_value={"records": rows}):
            r = TestClient(app).get("/api/arie/crop-guidance", params={
                "latitude": -11.479, "longitude": -77.180, "selected_crop": "tomato",
            })
        fetch.assert_awaited_once()
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["source"], "NASA POWER")
        self.assertEqual(r.json()["status"], "available")
        self.assertEqual(len(r.json()["history"]), 5)
        self.assertTrue(all(record["status"] == "complete" for record in r.json()["history"]))
        self.assertFalse(r.json()["can_recommend_sowing"])

    def test_one_missing_day_withholds_entire_annual_rainfall(self):
        start = date(2024, 1, 1)
        rows = [
            {"date": (start + timedelta(days=i)).isoformat(),
             "PRECTOTCORR": 1, "T2M": 19.0} for i in range(366)
        ]
        records = annual_summaries_from_daily(rows[:-1], 2024, 2024)
        self.assertEqual(records[0]["status"], "partial")
        self.assertIsNone(records[0]["precipitation_total_mm"])
        self.assertIsNone(records[0]["temperature_mean_c"])
        full = annual_summaries_from_daily(rows, 2024, 2024)
        self.assertEqual(full[0]["precipitation_total_mm"], 366)


if __name__ == "__main__":
    unittest.main()
