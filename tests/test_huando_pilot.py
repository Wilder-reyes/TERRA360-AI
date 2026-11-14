"""Official MIDAGRI Huando Huaral pilot, distinct from Huando Huancavelica."""
from unittest import TestCase
from fastapi.testclient import TestClient
from app.main import app
from app.api.routes import point_metadata, PILOT_LATITUDE, PILOT_LONGITUDE


class HuandoPilotTests(TestCase):
    def test_pilot_is_official_huaral_sector_centroid_not_a_parcel(self):
        response = TestClient(app).get("/api/pilot")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["sector_code"], "15060105")
        self.assertEqual(data["district"], "Huaral")
        self.assertEqual(data["province"], "Huaral")
        self.assertEqual(data["region"], "Lima")
        self.assertEqual(data["name"], "Huando, Huaral, Lima, Perú")
        self.assertAlmostEqual(data["latitude"], -11.47918514, places=7)
        self.assertAlmostEqual(data["longitude"], -77.18041962, places=7)
        self.assertFalse(data["boundary_validated"])
        self.assertEqual(data["coordinate_type"], "official_sector_centroid_not_parcel")
        self.assertIn("MIDAGRI", data["source"])
        self.assertNotIn("polygon", data)

    def test_point_selected_by_farmer_is_not_farm_boundary(self):
        point = point_metadata(PILOT_LATITUDE + .001, PILOT_LONGITUDE + .001)
        self.assertEqual(point["coordinate_type"], "user_selected_query_point_not_surveyed_parcel")
        center = point_metadata(PILOT_LATITUDE, PILOT_LONGITUDE)
        self.assertEqual(center["coordinate_type"], "official_sector_centroid_not_parcel")
        self.assertNotEqual(point["name"], center["name"])
