"""Offline SMAP original -> Calca native-grid HDF5 -> checksum-verified archive.

Synthetic grids are used solely to verify exact cell values, not to claim
actual NASA measurements. Real observations require Earthdata ingestion.
"""
from datetime import date
from hashlib import sha256
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
import json
import unittest
from unittest.mock import patch

import h5py
import numpy as np

from app.services.smap_subset import create_calca_native_subset, FIELDS, GROUP
from app.services.smap_regional import read_smap_am
from app.services.verified_archive import (
    ArchiveError, StorageConfig, object_keys, staged_granule,
    upload_verified, validate_manifest, MAX_GRANULE_BYTES,
    MAX_SMAP_SOURCE_BYTES, MAX_SMAP_SUBSET_BYTES,
)
from scripts.ingest_nasa_archive import _declared_smap_bytes

TARGET = date(2026, 11, 7)
FILENAME = "SMAP_L3_SM_P_E_20261107_R19240_001.h5"
CONFIG = StorageConfig("terra360-archive-test", "https://example.invalid", "auto")
POLYGON = {"type": "Polygon", "coordinates": [[
    [-71.958, -13.325], [-71.953, -13.325],
    [-71.953, -13.320], [-71.958, -13.320],
    [-71.958, -13.325],
]]}


class FakeStorage:
    def __init__(self):
        self.items = {}

    def exists(self, path):
        return path in self.items

    def info(self, path):
        if path not in self.items:
            raise FileNotFoundError(path)
        return {"size": len(self.items[path])}

    def open(self, path, mode):
        assert mode == "rb"
        return BytesIO(self.items[path])

    def find(self, prefix):
        return [key for key in self.items if key.startswith(prefix)]

    def put_file(self, local, remote):
        self.items[remote] = Path(local).read_bytes()

    def pipe_file(self, remote, value):
        self.items[remote] = bytes(value)


def original_synthetic(path: Path, *, has_calca=True):
    latitude_axis = np.linspace(-14.5, -12.5, 36, dtype=np.float32)
    longitude_axis = np.linspace(-73.0, -70.8, 36, dtype=np.float32)
    latitude = np.repeat(latitude_axis[:, None], 36, axis=1)
    longitude = np.repeat(longitude_axis[None, :], 36, axis=0)
    if not has_calca:
        latitude[:] = 42
        longitude[:] = -80
    values = (np.arange(36 * 36, dtype=np.float32).reshape((36, 36)) / 2000)
    flags = np.zeros((36, 36), dtype=np.uint16)
    with h5py.File(path, "w") as h5:
        group = h5.create_group(GROUP)
        for name, data in (
            ("latitude", latitude), ("longitude", longitude),
            ("soil_moisture_dca", values), ("retrieval_qual_flag_dca", flags),
        ):
            dataset = group.create_dataset(name, data=data)
            if name == "soil_moisture_dca":
                dataset.attrs["_FillValue"] = -9999.0


class CalcaNativeGridTests(unittest.TestCase):
    def test_extract_keeps_original_cell_values_dtypes_quality_and_source_sha(self):
        with TemporaryDirectory() as folder:
            original = Path(folder) / FILENAME
            derived = Path(folder) / "derived" / FILENAME
            original_synthetic(original)
            result = create_calca_native_subset(original, derived)
            self.assertIsNotNone(result)
            self.assertEqual(result["source_original_sha256"],
                             sha256(original.read_bytes()).hexdigest())
            self.assertEqual(result["source_original_size_bytes"], original.stat().st_size)
            self.assertLess(derived.stat().st_size, MAX_SMAP_SUBSET_BYTES)
            with h5py.File(original, "r") as src, h5py.File(derived, "r") as cropped:
                self.assertEqual(cropped.attrs["terra360_derived_subset"],
                                 "native_grid_calca_am_v1")
                self.assertTrue(cropped.attrs["no_interpolation"])
                for name in FIELDS:
                    source_values = src[GROUP][name][:]
                    subset_values = cropped[GROUP][name][:]
                    self.assertLess(subset_values.size, source_values.size)
                    self.assertEqual(subset_values.dtype, source_values.dtype)
                    self.assertTrue(np.isin(subset_values, source_values).all())
                self.assertEqual(cropped[GROUP]["soil_moisture_dca"].attrs["_FillValue"], -9999.0)
            observed = read_smap_am(derived, POLYGON, TARGET)
            self.assertEqual(observed["status"], "available")
            self.assertIsNotNone(observed["soil_moisture_m3_m3"])
            self.assertFalse(observed["can_infer_field_soil_moisture"])

    def test_original_without_calca_coverage_returns_no_derived_observations(self):
        with TemporaryDirectory() as folder:
            original = Path(folder) / FILENAME
            derived = Path(folder) / "derived" / FILENAME
            original_synthetic(original, has_calca=False)
            self.assertIsNone(create_calca_native_subset(original, derived))
            self.assertFalse(derived.exists())

    def test_derived_manifest_preserves_source_sha_and_detects_corruption(self):
        store = FakeStorage()
        with (patch("app.services.verified_archive.settings", return_value=CONFIG),
              patch("app.services.verified_archive.client", return_value=store)):
            with TemporaryDirectory() as folder:
                original = Path(folder) / FILENAME
                derived = Path(folder) / "derived" / FILENAME
                original_synthetic(original)
                provenance = create_calca_native_subset(original, derived)
                result = upload_verified("smap", TARGET, derived,
                                         source_id="G7777-NSIDC", source_metadata=provenance)
            self.assertEqual(result["product"], "SPL3SMP_E")
            data_key, manifest_key = object_keys("smap", TARGET)
            manifest_uri = f"{CONFIG.bucket}/{manifest_key}"
            manifest = json.loads(store.items[manifest_uri])
            self.assertEqual(manifest["verified_format"], "NASA-native-grid-regional-subset")
            self.assertEqual(manifest["source_original_sha256"], provenance["source_original_sha256"])
            with staged_granule("smap", TARGET) as restored:
                self.assertTrue(restored.is_file())
                self.assertEqual(sha256(restored.read_bytes()).hexdigest(), result["sha256"])
            manifest["source_original_sha256"] = "invalid"
            store.items[manifest_uri] = json.dumps(manifest).encode()
            with self.assertRaises(ArchiveError):
                with staged_granule("smap", TARGET):
                    pass

    def test_cannot_mislabel_unverified_smap_as_original_or_expand_file_limit(self):
        manifest = {"product": "SPL3SMP_E", "date": TARGET.isoformat(),
                    "sha256": "1" * 64, "filename": FILENAME,
                    "size_bytes": MAX_GRANULE_BYTES,
                    "verified_format": "NASA-original-granule"}
        with self.assertRaises(ArchiveError):
            validate_manifest("smap", TARGET, manifest)
        self.assertLess(MAX_SMAP_SUBSET_BYTES, MAX_GRANULE_BYTES)
        self.assertGreater(MAX_SMAP_SOURCE_BYTES, MAX_GRANULE_BYTES)

    def test_cmr_source_size_preflight_rejects_unbounded_claim(self):
        name = FILENAME
        granule = {"umm": {"DataGranule": {"ArchiveAndDistributionInformation": [
            {"Name": name, "SizeInBytes": str(325_000_000)},
        ]}}}
        self.assertEqual(_declared_smap_bytes(granule, [name]), 325_000_000)
        self.assertIsNone(_declared_smap_bytes(granule, ["other.h5"]))


if __name__ == "__main__":
    unittest.main()
