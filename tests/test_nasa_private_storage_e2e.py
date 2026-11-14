"""NASA private S3/R2 archival end-to-end tests with an in-memory transport.

No NASA token, cloud credentials, bucket or network needed. Exercises actual
SHA256 streaming/manifest/retention code; not satellite measurement accuracy.
"""
from datetime import date, timedelta
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
import json
import unittest
from unittest.mock import patch

from app.services.verified_archive import (
    ArchiveError, StorageConfig, object_keys, staged_granule,
    upload_verified, prune_expired, MAX_GRANULE_BYTES
)


class FakePrivateFS:
    def __init__(self):
        self.objects = {}
    def exists(self,path):
        return path in self.objects
    def info(self,path):
        if path not in self.objects:
            raise FileNotFoundError(path)
        return {"size":len(self.objects[path])}
    def open(self,path,mode):
        assert mode=="rb"
        if path not in self.objects:
            raise FileNotFoundError(path)
        return BytesIO(self.objects[path])
    def put_file(self,src,dst):
        self.objects[dst]=Path(src).read_bytes()
    def pipe_file(self,dst,data):
        self.objects[dst]=bytes(data)
    def find(self,prefix):
        matches=[key for key in self.objects if key.startswith(prefix)]
        if not matches:
            raise FileNotFoundError(prefix)
        return sorted(matches)
    def rm(self,path):
        self.objects.pop(path)


CONFIG=StorageConfig(bucket="terra360-archive-test",endpoint="https://example.invalid",region="auto")
TARGET=date(2026,11,5)


class PrivateObjectStorageTests(unittest.TestCase):
    def setUp(self):
        self.fs=FakePrivateFS()
        self.stor=patch("app.services.verified_archive.settings",return_value=CONFIG)
        self.conn=patch("app.services.verified_archive.client",return_value=self.fs)
        self.stor.start();self.conn.start()
        self.addCleanup(self.stor.stop);self.addCleanup(self.conn.stop)

    def write_staging(self,directory,when=TARGET):
        path=Path(directory)/f"3B-DAY-L.MS.MRG.3IMERG.{when:%Y%m%d}-S000000-E235959.V07C.nc4"
        path.write_bytes(b"science-data-for-integrity-test"*48)
        return path

    def test_manifest_is_sha_verified_and_render_copy_is_temporary(self):
        with TemporaryDirectory() as directory:
            file=self.write_staging(directory)
            result=upload_verified("gpm",TARGET,file,source_id="G1234567-GES_DISC")
        self.assertEqual(result["product"],"GPM_3IMERGDL")
        data_key,manifest_key=object_keys("gpm",TARGET)
        manifest=json.loads(self.fs.objects[f"{CONFIG.bucket}/{manifest_key}"])
        self.assertEqual(manifest["sha256"],result["sha256"])
        self.assertEqual(manifest["source_id"],"G1234567-GES_DISC")
        with staged_granule("gpm",TARGET) as path:
            self.assertTrue(path.is_file())
            self.assertEqual(path.read_bytes(),b"science-data-for-integrity-test"*48)
            transient=path
        self.assertFalse(transient.exists())

    def test_data_corruption_fails_without_exposing_fake_reading(self):
        with TemporaryDirectory() as directory:
            file=self.write_staging(directory)
            upload_verified("gpm",TARGET,file,source_id="G1234567-GES_DISC")
        data_key,_=object_keys("gpm",TARGET)
        uri=f"{CONFIG.bucket}/{data_key}"
        damaged=bytearray(self.fs.objects[uri])
        damaged[-1]^=1
        self.fs.objects[uri]=bytes(damaged)
        with self.assertRaises(ArchiveError):
            with staged_granule("gpm",TARGET) as _path:
                pass

    def test_duplicate_day_cannot_overwrite_original_evidence(self):
        with TemporaryDirectory() as directory:
            file=self.write_staging(directory)
            upload_verified("gpm",TARGET,file,source_id="G1234567-GES_DISC")
            with self.assertRaises(ArchiveError):
                upload_verified("gpm",TARGET,file,source_id="G1234567-GES_DISC")

    def test_archive_rejects_too_many_objects(self):
        for i in range(75):
            self.fs.objects[f"{CONFIG.bucket}/terra360-nasa-v1/gpm/cache{i}"]=b"x"
        with TemporaryDirectory() as directory:
            file=self.write_staging(directory)
            with self.assertRaises(ArchiveError):
                upload_verified("gpm",TARGET,file,source_id="G1234567-GES_DISC")

    def test_retention_cannot_delete_outside_prefix_or_recent_days(self):
        today=date(2026,11,14)
        old=today-timedelta(days=25)
        recent=today-timedelta(days=4)
        old_key,old_manifest=object_keys("gpm",old)
        recent_key,_=object_keys("gpm",recent)
        self.fs.objects[f"{CONFIG.bucket}/{old_key}"]=b"x"
        self.fs.objects[f"{CONFIG.bucket}/{old_manifest}"]=b"{}"
        self.fs.objects[f"{CONFIG.bucket}/{recent_key}"]=b"recent"
        unrelated=f"{CONFIG.bucket}/other-team-private/important"
        self.fs.objects[unrelated]=b"must-remain"
        output=prune_expired(keep_days=14,today=today)
        self.assertEqual(output["deleted_archive_dates"],1)
        self.assertNotIn(f"{CONFIG.bucket}/{old_key}",self.fs.objects)
        self.assertIn(f"{CONFIG.bucket}/{recent_key}",self.fs.objects)
        self.assertIn(unrelated,self.fs.objects)

    def test_manifest_oversized_object_stream_denied(self):
        with TemporaryDirectory() as directory:
            file=self.write_staging(directory)
            upload_verified("gpm",TARGET,file,source_id="G1234567-GES_DISC")
        data_key,manifest_key=object_keys("gpm",TARGET)
        manifest=json.loads(self.fs.objects[f"{CONFIG.bucket}/{manifest_key}"])
        manifest["size_bytes"]=MAX_GRANULE_BYTES+1
        self.fs.objects[f"{CONFIG.bucket}/{manifest_key}"]=json.dumps(manifest).encode()
        with self.assertRaises(ArchiveError):
            with staged_granule("gpm",TARGET) as _path:
                pass


if __name__=="__main__":
    unittest.main()
