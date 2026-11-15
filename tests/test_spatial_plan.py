"""Pure, offline contract checks for the CHAKRA three-step spatial planner."""
import unittest

from app.services.spatial_plan import build_spatial_plan


def polygon(west, south, east, north):
    return {"type": "Polygon", "coordinates": [[
        [west, south], [east, south], [east, north],
        [west, north], [west, south],
    ]]}


class SpatialPlanTests(unittest.TestCase):
    def setUp(self):
        self.field = polygon(-77.7395, -10.702, -77.7375, -10.700)
        self.left = polygon(-77.7395, -10.702, -77.7386, -10.700)
        self.right = polygon(-77.7384, -10.702, -77.7375, -10.700)
        self.climate = {
            "months": [{"month": m, "et0_mm_day": 4.8} for m in range(1, 13)]
        }

    def test_split_zone_plan_with_climate(self):
        result = build_spatial_plan(self.field, [
            {"id": "Zona 1", "crop_id": "maiz_amarillo_duro",
             "planted_month": "2026-01", "polygon": self.left},
            {"id": "Zona 2", "crop_id": "camote",
             "planted_month": "2026-03", "polygon": self.right},
            {"id": "rest", "crop_id": "vainita", "planted_month": "2026-02"},
        ], self.climate)
        self.assertEqual(result["status"], "prepared")
        self.assertEqual(len(result["zone_plans"]), 3)
        self.assertEqual(result["scope"], "barranca_reference")
        self.assertEqual(result["climate_status"], "nasa_power_reference")
        self.assertEqual(result["ai_status"], "agronomic_rule_engine")
        self.assertGreater(result["parcel_area_ha"], 1)
        for item in result["zone_plans"]:
            self.assertNotEqual(item["suggested_crop_id"], item["current_crop_id"])
            self.assertEqual(len(item["how_es"]), 4)
            self.assertRegex(item["sow_month"], r"^\d{4}-\d{2}$")
            self.assertGreater(item["area_ha"], 0)
            self.assertIsNotNone(item["reference_water_mm"])

    def test_other_region_does_not_inherit_lima_calendar_or_ai(self):
        field = polygon(-71.993, -13.517, -71.991, -13.515)
        result = build_spatial_plan(field, [
            {"id": "rest", "crop_id": "camote", "planted_month": "2026-07"}
        ])
        self.assertEqual(result["scope"], "exploratory_reference")
        self.assertEqual(result["ai_status"], "agronomic_rule_engine")
        self.assertEqual(result["climate_status"], "reference_rules")
        self.assertEqual(result["zone_plans"][0]["sowing_window_scope"], "farmer_check")

    def test_custom_horizons_have_chained_campaigns_without_overlap(self):
        for months in (3, 6, 12, 18, 24, 36, 60):
            with self.subTest(months=months):
                result = build_spatial_plan(self.field, [
                    {"id": "rest", "crop_id": "maiz_amarillo_duro",
                     "planted_month": "2026-01"},
                ], self.climate, planning_months=months)
                self.assertEqual(result["planning_months"], months)
                self.assertEqual(result["plan_kind"], "reference_rotation_not_future_weather_forecast")
                campaigns = result["zone_plans"][0]["campaigns"]
                for i, row in enumerate(campaigns):
                    self.assertLess(row["sow_month"], result["plan_end_month"])
                    self.assertLess(row["sow_month"], row["end_month"])
                    if i:
                        self.assertGreaterEqual(row["sow_month"], campaigns[i - 1]["end_month"])
                        self.assertNotEqual(row["crop_id"], campaigns[i - 1]["crop_id"])

    def test_invalid_planning_months_rejected(self):
        with self.assertRaisesRegex(ValueError, "3 y 60"):
            build_spatial_plan(self.field, [
                {"id": "rest", "crop_id": "camote", "planted_month": "2026-01"}
            ], planning_months=61)

    def test_overlapping_subplots_rejected(self):
        with self.assertRaisesRegex(ValueError, "superpongan"):
            build_spatial_plan(self.field, [
                {"id": "Zona 1", "crop_id": "camote", "planted_month": "2026-01",
                 "polygon": self.left},
                {"id": "Zona 2", "crop_id": "papa", "planted_month": "2026-01",
                 "polygon": self.left},
            ])

    def test_requires_crop_for_unassigned_remaining_area(self):
        with self.assertRaisesRegex(ValueError, "resto"):
            build_spatial_plan(self.field, [
                {"id": "Zona 1", "crop_id": "camote",
                 "planted_month": "2026-01", "polygon": self.left}
            ])

    def test_rejects_bad_crop(self):
        with self.assertRaises(ValueError):
            build_spatial_plan(self.field, [
                {"id": "rest", "crop_id": "ficticio", "planted_month": "2026-01"}
            ])


class SpatialEndpointTests(unittest.TestCase):
    """Verify the actual FastAPI contract independently of external NASA network."""

    def test_post_plan_returns_zones_for_off_site_field(self):
        from unittest.mock import patch, AsyncMock
        from fastapi.testclient import TestClient
        from app.main import app

        outline = polygon(-71.993, -13.517, -71.991, -13.515)
        payload = {
            "polygon": outline,
            "zones": [{"id": "rest", "crop_id": "camote",
                       "planted_month": "2026-06"}],
        }
        with patch("app.api.rotation_routes.monthly_climate",
                   new_callable=AsyncMock, return_value={
                       "months": [{"month": m, "et0_mm_day": 5}
                                  for m in range(1, 13)]
                   }):
            response = TestClient(app).post("/api/rotation/spatial-plan", json=payload)
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["status"], "prepared")
        self.assertEqual(body["scope"], "exploratory_reference")
        self.assertEqual(body["ai_status"], "agronomic_rule_engine")
        self.assertEqual(body["zone_plans"][0]["current_crop"], "Camote")
        self.assertTrue(body["zone_plans"][0]["how_es"])

    def test_endpoint_respects_planning_months(self):
        from fastapi.testclient import TestClient
        from unittest.mock import patch, AsyncMock
        from app.main import app
        with patch("app.api.rotation_routes.monthly_climate",
                   new_callable=AsyncMock, return_value={"months": []}):
            response = TestClient(app).post("/api/rotation/spatial-plan", json={
                "polygon": polygon(-71.993, -13.517, -71.991, -13.515),
                "zones": [{"id": "rest", "crop_id": "camote", "planted_month": "2026-01"}],
                "planning_months": 18,
            })
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["planning_months"], 18)
        self.assertIn("campaigns", response.json()["zone_plans"][0])

    def test_rejects_unknown_crop_cleanly(self):
        from fastapi.testclient import TestClient
        from unittest.mock import patch, AsyncMock
        from app.main import app
        with patch("app.api.rotation_routes.monthly_climate",
                   new_callable=AsyncMock, return_value={"months": []}):
            response = TestClient(app).post("/api/rotation/spatial-plan", json={
                "polygon": polygon(-71.993, -13.517, -71.991, -13.515),
                "zones": [{"id": "rest", "crop_id": "imaginary",
                           "planted_month": "2026-06"}],
            })
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
