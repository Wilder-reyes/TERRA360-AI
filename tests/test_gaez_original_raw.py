"""GAEZ real-source raw-cell contract tests, using artificial TIFF bytes only.

Actual FAO 437903-byte file is verified by independent live workflow, never
included in this repository or synthetic test.
"""
from hashlib import sha256
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch
import os

import httpx
import numpy as np
import rasterio
from rasterio.transform import from_origin
from fastapi.testclient import TestClient

from app.main import app
from app.services import gaez_original_raw as source
from app.services.gaez_selected import OFFICIAL_FILENAME

POLYGON={"type":"Polygon","coordinates":[[
    [-71.95720,-13.32270],[-71.95490,-13.32270],
    [-71.95490,-13.32050],[-71.95720,-13.32050],
    [-71.95720,-13.32270],
]]}


def fake_geotiff(path: Path):
    data=np.zeros((2160,4320),dtype="uint8")
    data[1239,1296]=8
    with rasterio.open(path,"w",driver="GTiff",height=2160,width=4320,
                       count=1,dtype="uint8",crs="EPSG:4326",
                       transform=from_origin(-180,90,1/12,1/12),
                       nodata=0,compress="deflate") as out:
        out.write(data,1)


class GAEZRawCellTests(TestCase):
    def test_original_grid_cell_is_not_a_crop_recommendation_or_percent(self):
        with TemporaryDirectory() as tmp:
            path=Path(tmp)/OFFICIAL_FILENAME
            fake_geotiff(path)
            output=source.inspect_raw_cell(path,POLYGON)
        self.assertEqual(output["status"],"raw_code_available")
        self.assertEqual(output["original_cell_class_code"],8)
        self.assertEqual(output["native_grid_resolution_degrees"],1/12)
        self.assertIsNone(output["suitability_index"])
        self.assertFalse(output["region_suitability_evaluated"])
        self.assertFalse(output["can_recommend_crop"])
        self.assertFalse(output["used_in_crop_decision"])
        self.assertEqual(output["interpretation_status"],"uninterpreted_original_class_code")

    def test_original_zero_pixel_is_nodata_not_low_suitability(self):
        other={"type":"Polygon","coordinates":[[
            [-72.2,-13.4],[-72.198,-13.4],
            [-72.198,-13.398],[-72.2,-13.398],[-72.2,-13.4]
        ]]}
        with TemporaryDirectory() as tmp:
            path=Path(tmp)/OFFICIAL_FILENAME
            fake_geotiff(path)
            output=source.inspect_raw_cell(path,other)
        self.assertEqual(output["status"],"official_raster_nodata")
        self.assertIsNone(output["original_cell_class_code"])

    def test_public_api_returns_raw_grid_code_not_suitability(self):
        with TemporaryDirectory() as tmp:
            path=Path(tmp)/OFFICIAL_FILENAME
            fake_geotiff(path)
            with patch("app.services.gaez_original_raw._cached_source_path",return_value=path):
                result=TestClient(app).post(
                    "/api/environment/gaez-v5/selected-layer/raw-cell",
                    json={"polygon":POLYGON}
                )
        self.assertEqual(result.status_code,200)
        self.assertEqual(result.json()["original_cell_class_code"],8)
        self.assertIsNone(result.json()["suitability_index"])
        self.assertEqual(TestClient(app).post(
            "/api/environment/gaez-v5/selected-layer/raw-cell",
            json={"polygon":{"type":"Point","coordinates":[-71,-13]}}
        ).status_code,422)

    def test_integrity_cache_is_pinned_single_fetch_and_reused(self):
        bytes_blob=b"FAO-authentic-bytes-are-never-fabricated-in-the-test"
        digest=sha256(bytes_blob).hexdigest()
        calls=[]
        def handler(request):
            calls.append(str(request.url))
            return httpx.Response(200,content=bytes_blob,
                                  headers={"Content-Length":str(len(bytes_blob))})
        client=httpx.Client(transport=httpx.MockTransport(handler))
        with TemporaryDirectory() as tmp:
            with patch.object(source,"OFFICIAL_SHA256",digest), \
                 patch.object(source,"OFFICIAL_BYTES",len(bytes_blob)), \
                 patch("app.services.gaez_original_raw.tempfile.gettempdir",return_value=tmp), \
                 patch("app.services.gaez_original_raw.httpx.Client",return_value=client), \
                 patch.object(source,"_last_failure",None):
                first=source._cached_source_path()
                self.assertTrue(first.is_file())
                self.assertEqual(first.read_bytes(),bytes_blob)
                again=source._cached_source_path()
                self.assertEqual(first,again)
                self.assertEqual(len(calls),1)
        client.close()

    def test_mismatched_sha_is_never_cached(self):
        bytes_blob=b"tampered"
        client=httpx.Client(transport=httpx.MockTransport(
            lambda request: httpx.Response(200,content=bytes_blob,
                                         headers={"Content-Length":str(len(bytes_blob))})))
        with TemporaryDirectory() as tmp:
            with patch.object(source,"OFFICIAL_SHA256","f"*64), \
                 patch.object(source,"OFFICIAL_BYTES",len(bytes_blob)), \
                 patch("app.services.gaez_original_raw.tempfile.gettempdir",return_value=tmp), \
                 patch("app.services.gaez_original_raw.httpx.Client",return_value=client), \
                 patch.object(source,"_last_failure",None):
                with self.assertRaises(source.GAEZOriginalError):
                    source._cached_source_path()
                self.assertEqual(list(Path(tmp).glob("*.tif")),[])
        client.close()


if __name__=="__main__":
    import unittest
    unittest.main()
