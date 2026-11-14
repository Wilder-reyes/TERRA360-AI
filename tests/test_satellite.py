import asyncio
import unittest
from datetime import date
import httpx
from fastapi.testclient import TestClient
from app.main import app
from app.connectors.planetary_computer import (
    SceneCatalogError, bounded_bbox, search_scenes, summarize_scenes
)

SCENES = {"type": "FeatureCollection", "features": [
    {"id":"scene1", "properties":{"datetime":"2026-11-01T10:00:00Z", "platform":"sentinel-2b", "eo:cloud_cover": 12.34}},
    {"id":"scene2", "properties":{"datetime":"2026-10-15T10:00:00Z", "eo:cloud_cover": 68}},
    {"id":"scene3", "properties":{"datetime":"2026-09-03T10:00:00Z", "eo:cloud_cover": None}},
]}

class SatelliteTests(unittest.TestCase):
    def test_bbox_around_free_point(self):
        box=bounded_bbox(-13.32175,-71.95605)
        self.assertTrue(box[0]<-71.95605<box[2])
        self.assertTrue(box[1]<-13.32175<box[3])
        self.assertNotEqual(box,bounded_bbox(10,12))
    def test_bbox_rejects_invalid_coordinates(self):
        with self.assertRaises(ValueError): bounded_bbox(91,0)
    def test_no_invented_ndvi(self):
        result=summarize_scenes(SCENES,35,5)
        self.assertEqual(len(result['scenes']),1)
        self.assertFalse(result['used_in_crop_decision'])
        self.assertNotIn('ndvi', result['scenes'][0])
    def test_empty_scenes_not_equated_no_imagery(self):
        result=summarize_scenes({'features':[]},35,5)
        self.assertEqual(result['status'],'no_matching_scenes')
    def test_invalid_catalog_json(self):
        with self.assertRaises(SceneCatalogError): summarize_scenes({'bad':[]},35,3)
    def test_remote_request_is_bounded_and_coordinate_specific(self):
        def handler(request):
            self.assertEqual(str(request.url),"https://planetarycomputer.microsoft.com/api/stac/v1/search")
            import json
            payload=json.loads(request.content)
            self.assertEqual(payload['collections'],['sentinel-2-l2a'])
            self.assertEqual(payload['limit'],80)
            self.assertTrue(payload['bbox'][0]<-71.95<payload['bbox'][2])
            return httpx.Response(200,json=SCENES)
        async def call():
            async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as c:
                return await search_scenes(-13.32,-71.95,today=date(2026,11,13),client=c)
        result=asyncio.run(call())
        self.assertEqual(result['period']['end'],'2026-11-13')
        self.assertEqual(len(result['scenes']),1)
    def test_api_requires_location_and_limits_request(self):
        c=TestClient(app)
        self.assertEqual(c.get('/api/environment/planetary-computer/scenes').status_code,422)
        self.assertEqual(c.get('/api/environment/planetary-computer/scenes?latitude=91&longitude=5').status_code,422)
        self.assertEqual(c.get('/api/environment/planetary-computer/scenes?latitude=0&longitude=2&days=999').status_code,422)
    def test_bad_remote_response_is_503(self):
        from unittest.mock import patch
        with patch('app.api.satellite_routes.search_scenes',side_effect=SceneCatalogError('service not available')):
            r=TestClient(app).get('/api/environment/planetary-computer/scenes?latitude=0&longitude=0')
        self.assertEqual(r.status_code,503)

class DeploymentSafetyTests(unittest.TestCase):
    def test_gpm_can_be_disabled_for_public_deployment(self):
        from unittest.mock import patch
        with patch.dict('os.environ', {'GPM_DOWNLOADS_ENABLED':'false'}):
            r=TestClient(app).get('/api/environment/gpm-imerg/daily?latitude=0&longitude=0&target_date=2026-11-10')
            self.assertEqual(r.status_code,503)
            combined=TestClient(app).get('/api/environment/observations/daily?latitude=0&longitude=0&start=2026-11-10&end=2026-11-10')
            self.assertEqual(combined.status_code,503)
