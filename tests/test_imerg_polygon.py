"""Deterministic geospatial NASA IMERG V07 tests, with synthetic 0.1° fixtures.

No fake values ever reach the production service: these are offline unit tests.
"""
from datetime import date, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

import numpy as np
import xarray as xr
from fastapi.testclient import TestClient

from app.main import app
from app.services.imerg_polygon import (
    sample_daily_imerg, daily_polygon_from_staged_file,
    IMERGPolygonError,
)

INSIDE_ONE = {"type":"Polygon","coordinates":[[
    [-71.958,-13.324],[-71.952,-13.324],
    [-71.952,-13.319],[-71.958,-13.319],
    [-71.958,-13.324]
]]}
CROSSES_TWO = {"type":"Polygon","coordinates":[[
    [-71.905,-13.324],[-71.895,-13.324],
    [-71.895,-13.319],[-71.905,-13.319],
    [-71.905,-13.324]
]]}
TARGET = date.today()-timedelta(days=9)


def fixture(*, left=10., right=20., count_left=48., count_right=48.,
            units="mm/day", step=.1):
    lon=np.array([-72.15,-72.05,-71.95,-71.85,-71.75])
    lat=np.array([-13.55,-13.45,-13.35,-13.25,-13.15])
    if step != .1:
        lon=np.array([-72.15 + i*step for i in range(5)])
    values=np.full((1,5,5),5.,dtype="float32")
    counts=np.full((1,5,5),48.,dtype="float32")
    values[0,2,2]=left
    values[0,2,3]=right
    counts[0,2,2]=count_left
    counts[0,2,3]=count_right
    ds=xr.Dataset({
        "precipitation":(("time","lat","lon"),values,{"units":units}),
        "precipitation_cnt":(("time","lat","lon"),counts),
    },coords={"lon":lon,"lat":lat,"time":[0]})
    return ds


class IMERGPolygonTests(unittest.TestCase):
    def test_one_coarse_cell_is_not_a_local_field_sensor(self):
        out=sample_daily_imerg(fixture(),INSIDE_ONE,TARGET)
        self.assertEqual(out["status"],"available")
        self.assertEqual(out["precipitation_mm_day"],10.0)
        self.assertEqual(out["grid_cell_count"],1)
        self.assertGreater(out["valid_area_percent_approx"],99)
        self.assertFalse(out["can_infer_field_rainfall"])
        self.assertFalse(out["used_in_crop_decision"])
        self.assertEqual(out["native_resolution"][:4],"0.1°")

    def test_boundary_uses_geodesic_overlap_not_nearest_center(self):
        out=sample_daily_imerg(fixture(),CROSSES_TWO,TARGET)
        self.assertEqual(out["status"],"available")
        self.assertEqual(out["grid_cell_count"],2)
        self.assertAlmostEqual(out["precipitation_mm_day"],15,delta=.01)
        self.assertTrue(99 < out["valid_area_percent_approx"] <= 100)
        self.assertAlmostEqual(sum(c["overlap_area_percent_approx"] for c in out["cells"]),100,delta=.1)

    def test_missing_grid_cell_causes_abstention_not_zero(self):
        out=sample_daily_imerg(fixture(count_right=0),CROSSES_TWO,TARGET)
        self.assertEqual(out["status"],"insufficient_valid_grid_coverage")
        self.assertIsNone(out["precipitation_mm_day"])
        self.assertEqual(out["valid_grid_cell_count"],1)
        self.assertTrue(40 < out["valid_area_percent_approx"] < 60)
        self.assertEqual(sum(c["precipitation_mm_day"] is None for c in out["cells"]),1)

    def test_zero_rain_is_valid_not_missing(self):
        out=sample_daily_imerg(fixture(left=0.),INSIDE_ONE,TARGET)
        self.assertEqual(out["status"],"available")
        self.assertEqual(out["precipitation_mm_day"],0)

    def test_nodata_is_not_treated_as_rain(self):
        for val in (float("nan"),-9999.9,-1.):
            with self.subTest(val=val):
                out=sample_daily_imerg(fixture(left=val),INSIDE_ONE,TARGET)
                self.assertIsNone(out["precipitation_mm_day"])
                self.assertEqual(out["status"],"insufficient_valid_grid_coverage")

    def test_unknown_units_or_non_native_grid_fail_closed(self):
        with self.assertRaises(IMERGPolygonError):
            sample_daily_imerg(fixture(units="mm/hour"),INSIDE_ONE,TARGET)
        with self.assertRaises(IMERGPolygonError):
            sample_daily_imerg(fixture(step=.05),INSIDE_ONE,TARGET)

    def test_no_local_granule_returns_honest_no_data_without_download(self):
        with TemporaryDirectory() as tmp:
            result=daily_polygon_from_staged_file(INSIDE_ONE,TARGET,Path(tmp))
        self.assertEqual(result["status"],"data_unavailable")
        self.assertIsNone(result["precipitation_mm_day"])
        self.assertEqual(result["grid_cell_count"],0)
        self.assertFalse(result["can_infer_field_rainfall"])

    def test_actual_h5netcdf_read_of_staged_file(self):
        with TemporaryDirectory() as tmp:
            root=Path(tmp)
            path=root/f"3B-DAY-L.MS.MRG.3IMERG.{TARGET:%Y%m%d}-S000000-E235959.V07C.nc4"
            fixture().to_netcdf(path,engine="h5netcdf")
            r=daily_polygon_from_staged_file(INSIDE_ONE,TARGET,root)
        self.assertEqual(r["status"],"available")
        self.assertEqual(r["precipitation_mm_day"],10)
        self.assertEqual(r["file"],path.name)
        self.assertTrue(r["quality_count_variable_used"])

    def test_api_missing_file_returns_200_with_null_not_fabricated(self):
        with patch("app.services.imerg_polygon.find_local_imerg",return_value=None):
            response=TestClient(app).post("/api/environment/gpm-imerg/polygon-daily",json={
                "polygon":INSIDE_ONE,"target_date":TARGET.isoformat(),
            })
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()["status"],"data_unavailable")
        self.assertIsNone(response.json()["precipitation_mm_day"])

    def test_api_rejects_invalid_shape_date_and_extra_reach(self):
        url="/api/environment/gpm-imerg/polygon-daily"
        client=TestClient(app)
        self.assertEqual(client.post(url,json={}).status_code,422)
        self.assertEqual(client.post(url,json={
            "polygon":{"type":"Point","coordinates":[1,2]},
            "target_date":TARGET.isoformat(),
        }).status_code,422)
        self.assertEqual(client.post(url,json={
            "polygon":INSIDE_ONE,"target_date":date.today().isoformat(),
        }).status_code,422)
        self.assertEqual(client.post(url,json={
            "polygon":INSIDE_ONE,"target_date":"2020-01-01",
        }).status_code,422)

if __name__ == "__main__":
    unittest.main()
