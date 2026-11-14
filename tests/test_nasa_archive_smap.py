"""Offline SMAP HDF5 and private NASA object store integrity tests.

No network, Earthdata credential or real NASA download is needed by CI.
"""
from datetime import date, timedelta
from hashlib import sha256
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch

import h5py
import numpy as np
from fastapi.testclient import TestClient

from app.main import app
from app.services.smap_regional import read_smap_am, regional_smap_from_archive, SMAPError
from app.services.verified_archive import (
    ArchiveError, verify_name, validate_manifest, object_keys,
    staged_granule, settings,
)

DATE = date.today() - timedelta(days=8)
POLYGON = {"type":"Polygon","coordinates":[[
    [-71.9572,-13.3227], [-71.9549,-13.3227],
    [-71.9549,-13.3205], [-71.9572,-13.3205],
    [-71.9572,-13.3227],
]]}


def write_h5(path, *, flag=0, moisture=.29, malformed=False):
    with h5py.File(path, "w") as h5:
        group=h5.create_group("Soil_Moisture_Retrieval_Data_AM")
        group.create_dataset("latitude", data=np.array([
            [-13.32,-13.32],[-13.52,-13.52]],dtype=np.float32))
        group.create_dataset("longitude", data=np.array([
            [-71.96,-71.76],[-71.96,-71.76]],dtype=np.float32))
        ds=group.create_dataset("soil_moisture_dca",data=np.array([
            [moisture,.10],[.22,.33]],dtype=np.float32))
        ds.attrs["_FillValue"]=-9999.0
        if not malformed:
            group.create_dataset("retrieval_qual_flag_dca",data=np.array([
                [flag,0],[0,0]],dtype=np.uint16))


class SMAPDataTests(TestCase):
    def test_actual_h5py_region_quality_good(self):
        with TemporaryDirectory() as directory:
            path=Path(directory)/f"SMAP_L3_SM_P_E_{DATE:%Y%m%d}_R001_006.h5"
            write_h5(path)
            result=read_smap_am(path,POLYGON,DATE)
        self.assertEqual(result["status"],"available")
        self.assertAlmostEqual(result["soil_moisture_m3_m3"],.29,places=3)
        self.assertEqual(result["cell"]["retrieval_quality_flag_dca"],0)
        self.assertLess(result["cell"]["distance_from_requested_center_km"],2)
        self.assertFalse(result["can_infer_field_soil_moisture"])
        self.assertFalse(result["used_in_crop_decision"])
        self.assertEqual(result["native_resolution_m"],9000)

    def test_quality_flag_rejects_not_reinterpret_as_dry_soil(self):
        with TemporaryDirectory() as directory:
            path=Path(directory)/f"SMAP_L3_SM_P_E_{DATE:%Y%m%d}_R001_006.h5"
            write_h5(path,flag=1)
            result=read_smap_am(path,POLYGON,DATE)
        self.assertEqual(result["status"],"insufficient_quality")
        self.assertIsNone(result["soil_moisture_m3_m3"])

    def test_negative_fill_and_out_of_range_rejected(self):
        for value in (-9999., -1., 1.9):
            with self.subTest(value=value), TemporaryDirectory() as directory:
                path=Path(directory)/"test.h5"
                write_h5(path,moisture=value)
                r=read_smap_am(path,POLYGON,DATE)
            self.assertIsNone(r["soil_moisture_m3_m3"])

    def test_missing_science_field_rejected(self):
        with TemporaryDirectory() as directory:
            path=Path(directory)/"test.h5"
            write_h5(path,malformed=True)
            with self.assertRaises(SMAPError):
                read_smap_am(path,POLYGON,DATE)

    def test_missing_private_archive_is_an_honest_null(self):
        with patch("app.services.verified_archive.settings",return_value=None):
            r=regional_smap_from_archive(POLYGON,DATE)
        self.assertEqual(r["status"],"data_unavailable")
        self.assertIsNone(r["soil_moisture_m3_m3"])

    def test_public_endpoint_missing_archive_and_invalid_date(self):
        uri="/api/environment/smap/regional-daily"
        with patch("app.services.verified_archive.settings",return_value=None):
            res=TestClient(app).post(uri,json={
                "polygon":POLYGON,"target_date":DATE.isoformat()
            })
        self.assertEqual(res.status_code,200)
        self.assertEqual(res.json()["status"],"data_unavailable")
        self.assertEqual(TestClient(app).post(uri,json={
            "polygon":POLYGON,"target_date":date.today().isoformat()
        }).status_code,422)
        self.assertEqual(TestClient(app).post(uri,json={
            "polygon":{"type":"Point","coordinates":[-71,-13]},
            "target_date":DATE.isoformat()
        }).status_code,422)


class ArchiveTests(TestCase):
    def test_daily_names_are_immutable_and_date_matched(self):
        verify_name("gpm",DATE,
            f"3B-DAY-L.MS.MRG.3IMERG.{DATE:%Y%m%d}-S000000-E235959.V07C.nc4")
        verify_name("smap",DATE,
            f"SMAP_L3_SM_P_E_{DATE:%Y%m%d}_R001_006.h5")
        for bad in ("../../hacked.nc4","example.nc4",
                    "3B-DAY-L.MS.MRG.3IMERG.20200101-S000000-E235959.V07C.nc4",
                    "SMAP_L3_SM_P_E_20200101_R001_006.h5"):
            with self.subTest(name=bad), self.assertRaises(ArchiveError):
                verify_name("gpm" if bad.endswith("nc4") else "smap",DATE,bad)

    def test_private_manifest_checks_sha_and_product(self):
        fake={"product":"SPL3SMP_E","date":DATE.isoformat(),
              "filename":f"SMAP_L3_SM_P_E_{DATE:%Y%m%d}_R001_006.h5",
              "size_bytes":1024,"sha256":"f"*64,
              "verified_format":"NASA-original-granule"}
        validate_manifest("smap",DATE,fake)
        for invalid in ({**fake,"sha256":"xyz"}, {**fake,"date":"2020-01-01"},
                        {**fake,"size_bytes":999999999},{**fake,"product":"GPM_3IMERGDL"}):
            with self.assertRaises(ArchiveError):
                validate_manifest("smap",DATE,invalid)

    def test_archive_never_uses_local_render_as_persistent_storage(self):
        with patch("app.services.verified_archive.settings",return_value=None):
            with staged_granule("gpm",DATE) as p:
                self.assertIsNone(p)
        key,manifest=object_keys("gpm",DATE)
        self.assertTrue(key.startswith("terra360-nasa-v1/gpm/"))
        self.assertTrue(manifest.endswith("manifest.json"))

if __name__=="__main__":
    import unittest
    unittest.main()
