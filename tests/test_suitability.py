"""Native-grid geography, attribution, missing data and bounded offline API."""
from copy import deepcopy
from hashlib import sha256
import json
from unittest import TestCase
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.schemas.suitability import SuitabilityRequest
from app.services import suitability as service


def request(**changes):
    return {"crop_id": "barley", "management": "LRLM",
            "bbox": service.manifest()["pilot_bbox"], **changes}


class SuitabilityTests(TestCase):
    def setUp(self):
        self.client = TestClient(app)
        service.load_tile.cache_clear()
        self.addCleanup(service.load_tile.cache_clear)

    def test_catalog_has_three_real_crops_explicit_scenarios_and_honest_water_factor(self):
        r = self.client.get("/api/agro/suitability/catalog")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual({c["id"] for c in data["crops"] if c["available"]}, {"maize", "potato", "barley"})
        self.assertFalse(next(c for c in data["crops"] if c["id"] == "faba")["available"])
        self.assertEqual({m["id"] for m in data["management"]}, {"LRLM", "HRLM", "LILM", "HILM"})
        self.assertEqual(data["source"]["period"], "2001–2020")
        self.assertFalse(data["source"]["current_soil_moisture_measured"])
        self.assertFalse(data["source"]["locally_validated"])
        self.assertFalse(data["coverage"]["administrative_boundary"])
        self.assertEqual(data["source"]["license"], "CC BY 4.0")
        self.assertEqual(len(data["factors"]), 5)
        self.assertNotIn("assets", data)

    def test_all_twelve_packaged_layers_are_pinned_and_retain_native_grid(self):
        data = service.manifest()
        self.assertEqual(data["grid"]["step_degrees"], 1/12)
        self.assertEqual(sum(map(len, data["assets"].values())), 12)
        for crop, scenarios in data["assets"].items():
            for management, asset in scenarios.items():
                tile, actual = service.load_tile(crop, management)
                self.assertEqual(actual, asset)
                self.assertEqual(tile["window"], [1272, 1212, 48, 48])
                self.assertEqual(sha256((service.DATA_DIR / asset["tile_file"]).read_bytes()).hexdigest(), asset["tile_sha256"])
                self.assertIn(".HP0120.AGERA5.HIST.", asset["source_url"])

    def test_pilot_real_classes_are_not_percentages_or_invented_success(self):
        response = self.client.post("/api/agro/suitability/map", json=request())
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "available")
        output = data["map"]
        # Regression anchor from the inspected FAO BRL/LRLM original, not a synthetic grid.
        self.assertEqual(output["summary"]["cells"], {"suitable": 2, "moderate": 2, "low": 60, "no_data": 0, "water": 0})
        self.assertEqual(len(output["geojson"]["features"]), 64)
        calca = next(f for f in output["geojson"]["features"] if f["id"] == "1239:1296")
        self.assertEqual(calca["properties"]["class_code"], 8)
        self.assertEqual(calca["properties"]["group"], "low")
        self.assertEqual(calca["properties"]["class_label_en"], "Not suitable")
        self.assertNotIn("success_probability", output)
        self.assertNotIn("suitability_percent", calca["properties"])
        self.assertEqual(output["source"]["raster_sha256"], "35176b51e02ede5074ea3f460ae07ef16607c201dfc8c0fa9dc6cd9e04cc17dd")

    def test_exact_grid_edges_do_not_add_an_extra_row_or_swap_coordinates(self):
        # Native cell 1239:1296 containing the town reference point.
        bbox = [-72, -13 - 4/12, -72 + 1/12, -13 - 3/12]
        result = service.suitability_map(SuitabilityRequest(**request(bbox=bbox)))["map"]
        self.assertEqual(result["summary"]["total_cells"], 1)
        feature = result["geojson"]["features"][0]
        self.assertEqual(feature["id"], "1239:1296")
        coordinates = feature["geometry"]["coordinates"][0]
        self.assertAlmostEqual(coordinates[0][0], -72)
        self.assertAlmostEqual(coordinates[0][1], -13 - 4/12)
        self.assertEqual(coordinates[0], coordinates[-1])
        self.assertGreater(result["summary"]["area_km2"]["low"], 80)
        self.assertLess(result["summary"]["area_km2"]["low"], 90)

    def test_tiny_query_keeps_native_geometry_but_area_only_counts_intersection(self):
        bbox = [-71.957, -13.323, -71.955, -13.321]
        output = service.suitability_map(SuitabilityRequest(**request(bbox=bbox)))["map"]
        self.assertEqual(output["summary"]["total_cells"], 1)
        self.assertAlmostEqual(output["summary"]["area_km2"]["low"], .048, places=3)
        self.assertAlmostEqual(output["geojson"]["features"][0]["geometry"]["coordinates"][0][0][0], -72)

    def test_no_data_and_water_never_become_low_or_suitable(self):
        for code, group in [(0, "no_data"), (9, "water")]:
            with self.subTest(code=code):
                fake = {"values": [[code] * 48 for _ in range(48)]}
                with patch.object(service, "load_tile", return_value=(fake, service.manifest()["assets"]["barley"]["LRLM"])):
                    result = service.suitability_map(SuitabilityRequest(**request()))
                self.assertEqual(result["status"], "no_land_data")
                self.assertEqual(result["map"]["summary"]["cells"][group], 64)
                self.assertEqual(result["map"]["summary"]["cells"]["suitable"], 0)
                self.assertEqual(result["map"]["summary"]["cells"]["low"], 0)
                self.assertEqual(result["map"]["summary"]["land_data_coverage_percent"], 0)

    def test_mixed_coverage_denominator_includes_missing_and_water(self):
        fake = {"values": [[0] * 48 for _ in range(48)]}
        # Four consecutive whole cells at one latitude: one apt, one low, one water, one missing.
        fake["values"][20][20:24] = [1, 8, 9, 0]
        bbox = [-74 + 20/12, -11 - 21/12, -74 + 24/12, -11 - 20/12]
        with patch.object(service, "load_tile", return_value=(fake, service.manifest()["assets"]["barley"]["LRLM"])):
            output = service.suitability_map(SuitabilityRequest(**request(bbox=bbox)))["map"]
        self.assertEqual(output["summary"]["total_cells"], 4)
        self.assertEqual(output["summary"]["land_data_coverage_percent"], 50)

    def test_crop_and_management_use_distinct_real_rasters(self):
        maize = service.suitability_map(SuitabilityRequest(**request(crop_id="maize")))["map"]
        barley = service.suitability_map(SuitabilityRequest(**request()))["map"]
        high = service.suitability_map(SuitabilityRequest(**request(management="HRLM")))["map"]
        self.assertEqual(maize["summary"]["cells"]["suitable"], 0)
        self.assertNotEqual(maize["source"]["raster_sha256"], barley["source"]["raster_sha256"])
        self.assertNotEqual(high["source"]["raster_sha256"], barley["source"]["raster_sha256"])
        self.assertNotEqual(high["summary"]["cells"], barley["summary"]["cells"])

    def test_unsupported_crop_and_outside_coverage_do_not_access_tiles(self):
        with patch.object(service, "load_tile") as load:
            self.assertEqual(self.client.post("/api/agro/suitability/map", json=request(crop_id="faba")).json(), {"status": "unsupported_crop", "map": None})
            self.assertEqual(self.client.post("/api/agro/suitability/map", json=request(bbox=[-80,-20,-79,-19])).json(), {"status": "outside_coverage", "map": None})
            load.assert_not_called()

    def test_request_limit_precedes_source_read(self):
        with patch.object(service, "load_tile") as load:
            response = self.client.post("/api/agro/suitability/map", json=request(bbox=[-74,-15,-70,-11]))
        self.assertEqual(response.status_code, 422)
        load.assert_not_called()
        self.assertIn("1024", response.json()["detail"])

    def test_invalid_geography_and_implicit_management_are_rejected(self):
        for change in [dict(bbox=[-70,-15,-74,-11]), dict(bbox=[-74,-11,-70,-15]),
                       dict(bbox=[-181,-15,-70,-11]), dict(bbox=[-74,-15,-74,-11]),
                       dict(bbox=[-72,-13,-72+1e-12,-12]), dict(crop_id="../../maize"),
                       dict(management=""), dict(extra=True)]:
            with self.subTest(change=change):
                self.assertEqual(self.client.post("/api/agro/suitability/map", json=request(**change)).status_code, 422)
        value = request()
        value.pop("management")
        self.assertEqual(self.client.post("/api/agro/suitability/map", json=value).status_code, 422)

    def test_corrupted_packaged_layer_fails_closed(self):
        with patch("pathlib.Path.read_bytes", return_value=b"{}"):
            with self.assertRaises(service.SuitabilityDataError):
                service.load_tile("barley", "LRLM")

    def test_unknown_class_is_rejected_even_if_the_tile_digest_matches(self):
        data = deepcopy(service.manifest())
        asset = data["assets"]["barley"]["LRLM"]
        tile = {"source_sha256": asset["source_sha256"], "window": [1272,1212,48,48], "values": [[10]*48 for _ in range(48)]}
        raw = json.dumps(tile).encode()
        asset["tile_sha256"] = sha256(raw).hexdigest()
        with patch.object(service, "manifest", return_value=data), patch("pathlib.Path.read_bytes", return_value=raw):
            with self.assertRaises(service.SuitabilityDataError):
                service.load_tile("barley", "LRLM")

    def test_bad_data_produces_503_instead_of_a_green_map(self):
        with patch.object(service, "load_tile", side_effect=service.SuitabilityDataError("test fixture")), self.assertLogs("app.api.suitability_routes", level="ERROR"):
            response = self.client.post("/api/agro/suitability/map", json=request())
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("geojson", response.json())
