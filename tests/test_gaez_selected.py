"""GAEZ v5 selected layer: metadata from FAO, optional raster offline fixture.

Fixtures do not claim to represent any actual FAO pixels or suitability.
"""
from hashlib import sha256
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch
import os

import numpy as np
import rasterio
from rasterio.transform import from_origin
from fastapi.testclient import TestClient

from app.main import app
from app.services.gaez_selected import SELECTED, OFFICIAL_FILENAME, OFFICIAL_SHA256, selected_raster_sample

POLYGON={"type":"Polygon","coordinates":[[
    [-71.9572,-13.3227],[-71.9549,-13.3227],
    [-71.9549,-13.3205],[-71.9572,-13.3205],
    [-71.9572,-13.3227]
]]}


class GAEZSelectionTests(TestCase):
    def test_official_catalog_dimensions_but_no_fake_raster(self):
        self.assertEqual(SELECTED["variable_code"],"RES05-SIX")
        self.assertEqual(SELECTED["crop_code"],"CSV")
        self.assertEqual(SELECTED["management_code"],"LRLM")
        self.assertEqual(SELECTED["period_code"],"HP0120")
        with patch.dict(os.environ,{
            "GAEZ5_APPROVED_TIFF":"","GAEZ5_APPROVED_SHA256":"",
            "GAEZ5_APPROVED_SCALE":"","GAEZ5_APPROVED_NODATA":"",
            "GAEZ5_LICENSE_URL":"",
        }):
            output=selected_raster_sample(POLYGON)
        self.assertEqual(output["status"],"official_raster_inspected_not_activated")
        self.assertIsNone(output["suitability_index"])
        self.assertFalse(output["used_in_crop_decision"])
        self.assertFalse(output["region_suitability_evaluated"])

    def test_api_catalog_and_missing_raster(self):
        client=TestClient(app)
        info=client.get("/api/environment/gaez-v5/selected-layer")
        self.assertEqual(info.status_code,200)
        self.assertIn("fao.org", info.json()["source_url"])
        with patch.dict(os.environ,{"GAEZ5_APPROVED_TIFF":""}):
            result=client.post("/api/environment/gaez-v5/selected-layer/sample",
                               json={"polygon":POLYGON})
        self.assertEqual(result.status_code,200)
        self.assertIsNone(result.json()["suitability_index"])
        self.assertEqual(client.post("/api/environment/gaez-v5/selected-layer/sample",
                                     json={"polygon":{"type":"Point","coordinates":[0,0]}}
                                     ).status_code,422)

    def test_raster_requires_complete_operator_manifest_and_exact_sha(self):
        with TemporaryDirectory() as root:
            filename=Path(root)/OFFICIAL_FILENAME
            values=np.full((100,100),35,dtype=np.int16)
            with rasterio.open(filename,"w",driver="GTiff",width=100,height=100,
                               count=1,dtype="int16",crs="EPSG:4326",
                               transform=from_origin(-72.2,-13.0,.00833333,.00833333),
                               nodata=-9999) as dst:
                dst.write(values,1)
            digest=sha256(filename.read_bytes()).hexdigest()
            env={
                "GAEZ5_APPROVED_TIFF":str(filename),
                "GAEZ5_APPROVED_SHA256":digest,
                "GAEZ5_APPROVED_SCALE":"1",
                "GAEZ5_APPROVED_NODATA":"-9999",
                "GAEZ5_LICENSE_URL":"https://creativecommons.org/licenses/by/4.0/",
                "GAEZ5_SCIENTIFIC_SCALE_APPROVED":"true",
            }
            with patch("app.services.gaez_selected.OFFICIAL_SHA256",digest), patch.dict(os.environ,env):
                output=selected_raster_sample(POLYGON)
            self.assertEqual(output["status"],"coarse_raster_cell_available")
            self.assertEqual(output["suitability_index"],35)
            self.assertFalse(output["used_in_crop_decision"])
            self.assertEqual(output["raster_sha256"],digest)
            self.assertTrue(output["region_suitability_evaluated"])
            with patch.dict(os.environ,{**env,"GAEZ5_APPROVED_SHA256":"f"*64}):
                resp=TestClient(app).post(
                    "/api/environment/gaez-v5/selected-layer/sample",
                    json={"polygon":POLYGON})
            self.assertEqual(resp.status_code,503)
            self.assertEqual(SELECTED["inspected_sha256"],OFFICIAL_SHA256)
            self.assertEqual(SELECTED["inspected_nodata"],0)
            self.assertTrue(SELECTED["exact_tiff_object_verified"])
            self.assertFalse(SELECTED["license_for_exact_asset_verified"])

if __name__=="__main__":
    import unittest
    unittest.main()
