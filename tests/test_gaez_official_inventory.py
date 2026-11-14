"""Official FAO RES05 inventory tests: no cloud requests in unit tests."""
from io import BytesIO
import unittest
from unittest.mock import Mock, patch

import pandas as pd

from scripts.verify_gaez_res05_official import (
    COLUMNS, SELECTION, EXACT_PATTERN, FAO_BASE_URL,
    VerificationError, read_catalog, select_one, check_official_object,
)


def fixture(*, duplicates=False, invalid_name=False):
    header=list(COLUMNS)
    rows=[
        ["FAO RES05 inventory", None, None, None, None, None, None],
        header,
        ["RES05-SIX","HP0120","AGERA5","HIST","CSV","LRLM",
         "GAEZ-V5.RES05-SIX.HP0120.AGERA5.HIST.CSV.LRLM" if not invalid_name else "../evil"],
        ["RES05-SIX","HP8100","AGERA5","HIST","CSV","LRLM",
         "GAEZ-V5.RES05-SIX.HP8100.AGERA5.HIST.CSV.LRLM"],
    ]
    if duplicates:
        rows.append(rows[2][:])
    return pd.DataFrame(rows)


class FAOInventoryUnitTests(unittest.TestCase):
    def test_official_six_dimensions_and_exact_file_match(self):
        with patch("pandas.read_excel",return_value=fixture()):
            catalog=read_catalog(b"test")
        found=select_one(catalog)
        self.assertTrue(found["catalog_match_verified"])
        self.assertEqual(found["selection"],SELECTION)
        self.assertTrue(EXACT_PATTERN.fullmatch(found["file_name"]))
        self.assertTrue(found["url"].startswith(FAO_BASE_URL + "/RES05-SIX/"))
        self.assertTrue(found["url"].endswith("GAEZ-V5.RES05-SIX.HP0120.AGERA5.HIST.CSV.LRLM.tif"))

    def test_ambiguous_or_missing_record_abstains(self):
        for duplicate in (True,False):
            with self.subTest(duplicate=duplicate):
                with patch("pandas.read_excel",return_value=fixture(duplicates=duplicate)):
                    catalog=read_catalog(b"test")
                if not duplicate:
                    catalog.loc[:, "CROP"] = "MAIZ"
                with self.assertRaises(VerificationError):
                    select_one(catalog)

    def test_traversal_and_name_mismatch_rejected(self):
        with patch("pandas.read_excel",return_value=fixture(invalid_name=True)):
            catalog=read_catalog(b"test")
        with self.assertRaises(VerificationError):
            select_one(catalog)

    def test_blank_or_oversize_fao_file_rejected_without_parsing(self):
        with self.assertRaises(VerificationError):
            read_catalog(b"")
        with self.assertRaises(VerificationError):
            read_catalog(b"X"*(24*1024*1024+1))

    def test_head_200_with_length_proves_object_only_not_raster_science(self):
        found={
            "catalog_match_verified":True,
            "selection":SELECTION,
            "file_name":"GAEZ-V5.RES05-SIX.HP0120.AGERA5.HIST.CSV.LRLM.tif",
            "url":FAO_BASE_URL+"/RES05-SIX/GAEZ-V5.RES05-SIX.HP0120.AGERA5.HIST.CSV.LRLM.tif",
        }
        session=Mock()
        session.head.return_value=Mock(status_code=200,
                                       headers={"Content-Length":"123456",
                                                "ETag":'"official-etag"',
                                                "x-goog-generation":"98765"})
        result=check_official_object(found,session=session)
        self.assertTrue(result["public_object_verified"])
        self.assertFalse(result["raster_sha256_verified"])
        self.assertFalse(result["exact_asset_license_verified"])
        self.assertFalse(result["raster_geospatial_metadata_verified"])
        self.assertIsNone(result["suitability_index"])
        self.assertFalse(result["used_in_crop_decision"])
        session.head.assert_called_once()

    def test_403_and_404_do_not_count_as_verified(self):
        found={"url":FAO_BASE_URL+"/RES05-SIX/example.tif"}
        for status in (403,404,500):
            with self.subTest(status=status):
                session=Mock()
                session.head.return_value=Mock(status_code=status,headers={})
                result=check_official_object(found,session=session)
                self.assertFalse(result["public_object_verified"])
                self.assertIsNone(result["suitability_index"])


if __name__=="__main__":
    unittest.main()


class RealRasterInspectorContractTests(unittest.TestCase):
    def test_inspection_of_small_georeferenced_tiff_is_not_crop_advice(self):
        from tempfile import TemporaryDirectory
        from pathlib import Path
        import numpy as np
        import rasterio
        from rasterio.transform import from_origin
        from scripts.inspect_fao_gaez_raster import inspect_raster
        with TemporaryDirectory() as directory:
            path=Path(directory)/"GAEZ-V5.RES05-SIX.HP0120.AGERA5.HIST.CSV.LRLM.tif"
            with rasterio.open(path, "w", driver="GTiff", width=24, height=24,
                               count=1, dtype="int16", crs="EPSG:4326",
                               transform=from_origin(-72.0, -13.2, 0.01, 0.01),
                               nodata=-9999) as out:
                out.write(np.full((24,24), 57, dtype="int16"), 1)
            record={"public_object_verified":True, "file_name":path.name}
            details=inspect_raster(path,record)
        self.assertEqual(details["driver"],"GTiff")
        self.assertEqual(details["crs"],"EPSG:4326")
        self.assertEqual(details["calca_reference_raw_pixel"],57)
        self.assertEqual(len(details["tiff_sha256"]),64)
        self.assertIsNone(details["suitability_index"])
        self.assertFalse(details["exact_asset_license_verified"])
        self.assertFalse(details["scale_semantics_verified"])
        self.assertFalse(details["used_in_crop_decision"])
