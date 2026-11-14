"""Offline time-series tests: no network, no invented measurements."""
import asyncio
from datetime import date, timedelta
import json
import unittest
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient

from app.main import app
from app.services.sentinel_ndvi import NDVIError
from app.services.sentinel_timeseries import (
    _utc_date, select_spaced_scenes, summarize_series,
    calculate_parcel_ndvi_series,
)

POLYGON = {"type":"Polygon","coordinates":[[
    [-71.9572,-13.3227],[-71.9549,-13.3227],
    [-71.9549,-13.3205],[-71.9572,-13.3205],
    [-71.9572,-13.3227]
]]}


def scene(dt: str, cloud=12.0, scene_id=None):
    return {"id":scene_id or ("s-"+dt[:10]),"properties":{
        "datetime":dt,"eo:cloud_cover":cloud,
        "s2:processing_baseline":"05.13",
        "platform":"Sentinel-2C",
    }}


class SeriesSelectionTests(unittest.TestCase):
    def test_strict_utc_parsing(self):
        self.assertEqual(_utc_date("2026-11-04T14:57:00Z"), date(2026,11,4))
        for bad in ("2026-11-04", "2026-11-04T14:57:00", "2026-99-99T20:00:00Z", None):
            self.assertIsNone(_utc_date(bad))

    def test_cloud_date_spacing_and_deduplication(self):
        items = [
            scene("2026-11-14T10:00:00Z", 25, "14_b"),
            scene("2026-11-14T11:00:00Z", 10, "14_a"),
            scene("2026-11-10T10:00:00Z", 3, "10"),
            scene("2026-10-30T10:00:00Z", 35, "30"),
            scene("2026-10-19T10:00:00Z", 15, "19"),
            scene("2026-10-01T10:00:00Z", 3, "01"),
            scene("2026-09-10T10:00:00Z", 75, "too_cloudy"),
            scene("2026-12-01T10:00:00Z", 1, "future"),
            scene("2026-08-01T10:00:00Z", 1, "before_window"),
            scene("bad-format", 1, "bad"),
        ]
        found = select_spaced_scenes(items, date(2026,9,1),date(2026,11,14),60,max_attempts=4)
        self.assertEqual([s["id"] for s in found], ["14_a","30","01"])

    def test_tie_breaks_and_limit(self):
        items=[scene(f"2026-11-{d:02d}T10:00:00Z",10,str(d)) for d in (14,13,12,1)]
        out=select_spaced_scenes(items,date(2026,11,1),date(2026,11,14),60,max_attempts=2)
        self.assertEqual([s["id"] for s in out], ["14","1"])
        with self.assertRaises(ValueError):
            select_spaced_scenes(items,date(2026,11,1),date(2026,11,14),60,max_attempts=999)

    def test_no_false_time_trend_and_missing_values(self):
        records = [
            {"date":"2026-10-01","scene_id":"x","status":"available",
             "metrics":{"ndvi":{"mean":.2},"valid_fraction_percent":95}},
            {"date":"2026-11-04","scene_id":"y","status":"insufficient_clear_pixels",
             "metrics":{"ndvi":None,"valid_fraction_percent":7}},
        ]
        result=summarize_series(records,2,12000,date(2026,9,1),date(2026,11,14),60,12)
        self.assertEqual(result["status"], "single_valid_observation")
        self.assertEqual(result["valid_observation_count"],1)
        self.assertFalse(result["can_infer_vegetation_trend"])
        self.assertFalse(result["can_predict_crop_health"])
        self.assertFalse(result["used_in_crop_decision"])
        self.assertIsNone(result["observations"][1]["metrics"]["ndvi"])

    def test_no_scenes_avoids_inventing_zeros(self):
        r=summarize_series([],0,10000,date(2026,10,1),date(2026,11,14),60,0)
        self.assertEqual(r["status"],"no_matching_scenes")
        self.assertEqual(r["observations"],[])
        self.assertEqual(r["valid_observation_count"],0)

    def test_api_rejects_bad_bounds_and_geometry(self):
        client=TestClient(app)
        path="/api/environment/sentinel-2/parcel-ndvi-series"
        self.assertEqual(client.post(path,json={}).status_code,422)
        self.assertEqual(client.post(path,json={"polygon":POLYGON,"max_observations":12}).status_code,422)
        self.assertEqual(client.post(path,json={"polygon":POLYGON,"days":25}).status_code,422)
        self.assertEqual(client.post(path,json={"polygon":{"type":"Point","coordinates":[0,0]}}).status_code,422)

    def test_api_maps_provider_errors_to_503(self):
        from app.services.sentinel_timeseries import calculate_parcel_ndvi_series
        with patch("app.services.sentinel_timeseries.calculate_parcel_ndvi_series",
                   side_effect=NDVIError("Unavailable")):
            resp=TestClient(app).post("/api/environment/sentinel-2/parcel-ndvi-series",json={"polygon":POLYGON})
            self.assertEqual(resp.status_code,503)


class SeriesIntegrationTests(unittest.TestCase):
    def test_mock_stac_with_real_pixels_function_and_missing_quality(self):
        items=[
            scene("2026-10-03T10:00:00Z",12),
            scene("2026-10-19T10:00:00Z",12),
            scene("2026-11-04T10:00:00Z",12),
            scene("2026-11-13T10:00:00Z",12),
        ]
        def handler(request):
            payload=json.loads(request.content)
            self.assertEqual(payload["collections"],["sentinel-2-l2a"])
            self.assertEqual(payload["limit"],120)
            return httpx.Response(200,json={"features":items})

        def read_mock(item,poly,area):
            if item["id"].endswith("10-19"):
                return {"status":"insufficient_clear_pixels","ndvi":None,
                        "valid_pixels":3,"valid_fraction_percent":3}
            mean={ "s-2026-11-04":.35,"s-2026-10-03":.18 }.get(item["id"],.22)
            return {"status":"available","ndvi":{"mean":mean},"valid_pixels":95,
                    "valid_fraction_percent":90}

        async def invoke():
            async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                with patch("app.services.sentinel_timeseries.process_scene", side_effect=read_mock):
                    return await calculate_parcel_ndvi_series(POLYGON,days=90,
                        client=client,today=date(2026,11,14),max_observations=2)
        r=asyncio.run(invoke())
        self.assertEqual(r["status"],"available")
        self.assertEqual(r["valid_observation_count"],2)
        self.assertLessEqual(r["attempted_scenes"],8)
        self.assertEqual([x["date"] for x in r["observations"]],
                         sorted(x["date"] for x in r["observations"]))
        self.assertTrue(all("scene_id" in x for x in r["observations"]))
        self.assertFalse(r["can_infer_vegetation_trend"])
        self.assertNotIn("signed",json.dumps(r))

    def test_all_quality_failed_no_ndvi(self):
        items=[scene("2026-11-06T10:00:00Z"),scene("2026-10-01T10:00:00Z")]
        def handler(request):
            return httpx.Response(200,json={"features":items})
        async def invoke():
            async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                with patch("app.services.sentinel_timeseries.process_scene",
                           return_value={"status":"insufficient_clear_pixels","valid_pixels":4,
                                         "valid_fraction_percent":5,"ndvi":None}):
                    return await calculate_parcel_ndvi_series(POLYGON,client=client,
                        days=120,today=date(2026,11,15))
        r=asyncio.run(invoke())
        self.assertEqual(r["status"],"no_usable_observations")
        self.assertEqual(r["valid_observation_count"],0)
        self.assertTrue(all(row["metrics"]["ndvi"] is None for row in r["observations"]))

    def test_catalog_failure_is_clean_503(self):
        def handler(request):
            return httpx.Response(503)
        async def invoke():
            async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                return await calculate_parcel_ndvi_series(POLYGON,client=client,
                    days=120,today=date(2026,11,16))
        with self.assertRaises(NDVIError):
            asyncio.run(invoke())

if __name__=="__main__":
    unittest.main()
