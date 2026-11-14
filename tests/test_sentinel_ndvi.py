"""Deterministic tests; never rely on network imagery in normal CI."""
import asyncio
from datetime import date
from unittest import TestCase
from unittest.mock import patch
import numpy as np
import httpx
from fastapi.testclient import TestClient
from app.main import app
from app.services.sentinel_ndvi import (
    analyze_pixels, parse_baseline, validate_parcel, calculate_parcel_ndvi,
    NDVIError,
)

POLYGON = {"type": "Polygon", "coordinates": [[
    [-71.9564, -13.3220], [-71.9554, -13.3220],
    [-71.9554, -13.3210], [-71.9564, -13.3210],
    [-71.9564, -13.3220],
]]}


class NDVIPixelTests(TestCase):
    def test_correct_baseline_offset_before_ndvi(self):
        inside = np.ones((5, 5), bool)
        scl = np.full((5, 5), 4, dtype="uint8")
        red = np.full((5, 5), 3000, dtype="uint16")
        nir = np.full((5, 5), 5000, dtype="uint16")
        modern = analyze_pixels(red, nir, scl, inside, 5.1, 2500, 100)
        legacy = analyze_pixels(red, nir, scl, inside, 3.0, 2500, 100)
        self.assertEqual(modern["status"], "available")
        self.assertEqual(modern["ndvi"]["mean"], round((4000 - 2000) / 6000, 4))
        self.assertEqual(legacy["ndvi"]["mean"], .25)

    def test_excludes_cloud_shadow_water_snow_and_invalid_dn(self):
        inside = np.ones((5, 5), bool)
        scl = np.full((5, 5), 4, dtype="uint8")
        scl[0, :] = [0, 3, 6, 9, 11]
        red = np.full((5, 5), 2000, dtype="uint16")
        nir = np.full((5, 5), 4000, dtype="uint16")
        red[1, 0] = 0
        r = analyze_pixels(red, nir, scl, inside, 5.0, 2500, 100)
        self.assertEqual(r["valid_pixels"], 19)
        self.assertEqual(r["status"], "insufficient_clear_pixels")
        self.assertIsNone(r["ndvi"])
        self.assertIn("9", r["scl_classes_within_parcel"])

    def test_no_data_must_not_be_corrected_into_negative_reflectance(self):
        z = np.zeros((5, 5), dtype="uint16")
        r = analyze_pixels(z, z, np.full((5, 5), 4), np.ones((5, 5), bool),
                           5.1, 2500, 100)
        self.assertEqual(r["valid_pixels"], 0)
        self.assertIsNone(r["ndvi"])

    def test_partial_tile_coverage_not_presented_as_full_parcel(self):
        inside = np.ones((5, 5), bool)
        r = analyze_pixels(np.full((5, 5), 3000), np.full((5, 5), 5000),
                           np.full((5, 5), 4), inside, 5.1, 10000, 100)
        self.assertEqual(r["scene_coverage_percent_approx"], 25)
        self.assertEqual(r["status"], "insufficient_clear_pixels")

    def test_rejects_missing_baseline(self):
        with self.assertRaises(ValueError):
            parse_baseline(None)
        self.assertEqual(parse_baseline("05.10"), 5.1)

    def test_polygon_rejects_invalid_shapes_and_oversized(self):
        parcel, area = validate_parcel(POLYGON)
        self.assertTrue(parcel.is_valid)
        self.assertGreater(area, 1000)
        bowtie = {"type": "Polygon", "coordinates": [[
            [-71.9564, -13.322], [-71.9554, -13.321],
            [-71.9564, -13.321], [-71.9554, -13.322],
            [-71.9564, -13.322],
        ]]}
        with self.assertRaises(ValueError):
            validate_parcel(bowtie)
        with self.assertRaises(ValueError):
            validate_parcel({"type":"Polygon","coordinates":[[
                [-72,-14],[-71,-14],[-71,-13],[-72,-13],[-72,-14]
            ]]})

    def test_only_approved_raster_host_and_signing_failures(self):
        from app.services.sentinel_ndvi import _safe_signed_asset
        for href in ("file:///etc/passwd", "https://example.org/test.tif",
                     "http://sentinel2l2a01.blob.core.windows.net/test.tif"):
            with self.assertRaises(NDVIError):
                _safe_signed_asset({"assets":{"B04":{"href":href}}}, "B04")
        asset = {"assets":{"B04":{"href":
            "https://sentinel2l2a01.blob.core.windows.net/example/file.tif"}}}
        with patch("app.services.sentinel_ndvi.planetary_computer.sign",
                   side_effect=RuntimeError("provider throttled")):
            with self.assertRaises(NDVIError):
                _safe_signed_asset(asset, "B04")

    def test_api_success_preserves_science_abstention(self):
        fake = {"status":"available", "scene":{"date":"2026-11-04"},
                "metrics":{"ndvi":{"mean":.1776}},
                "used_in_crop_decision":False}
        with patch("app.api.ndvi_routes.calculate_parcel_ndvi", return_value=fake):
            response = TestClient(app).post(
                "/api/environment/sentinel-2/parcel-ndvi",
                json={"polygon":POLYGON})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["metrics"]["ndvi"]["mean"], .1776)
        self.assertFalse(response.json()["used_in_crop_decision"])

    def test_api_rejects_unsafe_and_small_areas(self):
        client = TestClient(app)
        self.assertEqual(client.post("/api/environment/sentinel-2/parcel-ndvi", json={}).status_code, 422)
        self.assertEqual(client.post("/api/environment/sentinel-2/parcel-ndvi", json={
            "polygon": {"type": "Point", "coordinates": [-71, -13]}
        }).status_code, 422)

    def test_service_error_is_recoverable(self):
        with patch("app.api.ndvi_routes.calculate_parcel_ndvi", side_effect=NDVIError("remote unavailable")):
            r = TestClient(app).post("/api/environment/sentinel-2/parcel-ndvi", json={"polygon": POLYGON})
        self.assertEqual(r.status_code, 503)


    def test_real_windowed_geotiff_geometry_and_scl_resampling(self):
        import tempfile
        from pathlib import Path
        import rasterio
        from pyproj import Transformer
        from rasterio.transform import from_origin
        from app.services.sentinel_ndvi import process_scene

        x, y = Transformer.from_crs("EPSG:4326", "EPSG:32719", always_xy=True).transform(
            -71.9559, -13.3215)
        polygon, area = validate_parcel(POLYGON)
        with tempfile.TemporaryDirectory() as root:
            base = Path(root)
            paths = {}
            for name, value, dimension, resolution in [
                ("B04", 3000, 80, 10),
                ("B08", 5000, 80, 10),
                ("SCL", 4, 40, 20),
            ]:
                path = base / f"{name}.tif"
                arr = np.full((dimension, dimension), value,
                              dtype="uint8" if name == "SCL" else "uint16")
                with rasterio.open(path, "w", driver="GTiff", height=dimension,
                                   width=dimension, count=1, dtype=arr.dtype,
                                   crs="EPSG:32719",
                                   transform=from_origin(x - 400, y + 400,
                                                         resolution, resolution),
                                   nodata=0) as dst:
                    dst.write(arr, 1)
                paths[name] = str(path)
            scene = {"properties":{"s2:processing_baseline":"05.10"}}
            with patch("app.services.sentinel_ndvi._safe_signed_asset",
                       side_effect=lambda item, key: paths[key]):
                metrics = process_scene(scene, polygon, area)
        self.assertEqual(metrics["status"], "available")
        self.assertGreater(metrics["valid_pixels"], 20)
        self.assertEqual(metrics["ndvi"]["mean"], .3333)
        self.assertGreater(metrics["valid_fraction_percent"], 75)



class NDVICatalogTests(TestCase):
    def test_search_real_catalog_shape_but_mocked_rasters(self):
        item = {"id":"S2_scene_example", "properties":{
            "datetime":"2026-11-10T10:00:00Z",
            "eo:cloud_cover":15,
            "s2:processing_baseline":"05.10",
            "platform":"sentinel-2b",
        }}
        def handler(request):
            self.assertEqual(request.url.path, "/api/stac/v1/search")
            import json
            q = json.loads(request.content)
            self.assertEqual(q["collections"], ["sentinel-2-l2a"])
            self.assertEqual(len(q["bbox"]), 4)
            return httpx.Response(200, json={"type":"FeatureCollection", "features":[item]})

        async def call():
            async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                with patch("app.services.sentinel_ndvi.process_scene", return_value={
                    "status":"available", "valid_pixels":40, "parcel_pixels":40,
                    "valid_fraction_percent":90, "ndvi":{"mean":.45}
                }):
                    return await calculate_parcel_ndvi(POLYGON, client=client, today=date(2026, 11, 14))
        result = asyncio.run(call())
        self.assertEqual(result["status"], "available")
        self.assertEqual(result["scene"]["processing_baseline"], "05.10")
        self.assertFalse(result["used_in_crop_decision"])
        self.assertNotIn("assets", str(result))
        self.assertIn("Percentiles", result["uncertainty"][0])

    def test_empty_search_does_not_invent_measurement(self):
        shifted = {"type":"Polygon","coordinates":[[
            [-70.9564,-13.322],[-70.9554,-13.322],
            [-70.9554,-13.321],[-70.9564,-13.321],
            [-70.9564,-13.322]
        ]]}
        def handler(request):
            return httpx.Response(200, json={"features":[]})
        async def call():
            async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                return await calculate_parcel_ndvi(shifted, client=client, today=date(2026, 11, 14))
        result = asyncio.run(call())
        self.assertEqual(result["status"], "no_matching_scenes")
        self.assertIsNone(result["metrics"])
