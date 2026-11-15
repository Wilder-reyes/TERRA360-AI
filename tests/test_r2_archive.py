"""R2 quota/safety tests with a fake store: no credentials, no HTTP, no charges."""
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock
from app.services import r2_archive as R


class R2ArchiveTests(unittest.TestCase):
    def setUp(self):
        R.ALLOWED_ROOT.mkdir(parents=True, exist_ok=True)
        self.tmp=tempfile.TemporaryDirectory(dir=R.ALLOWED_ROOT)
        self.source=Path(self.tmp.name)/"3B-DAY-L.MS.MRG.3IMERG.20261111-S000000-E235959.V07C.nc4"
        self.source.write_bytes(b"NASA test bytes; not real scientific data")
        self.addCleanup(self.tmp.cleanup)

    def test_explicit_enable_required(self):
        with patch.dict(os.environ,{"BIOTEX_R2_ENABLED":"0"}):
            with self.assertRaises(R.ArchiveUnavailable):
                R.archive_original(self.source,fs=MagicMock())

    def test_quota_abstains_without_writing(self):
        fake=MagicMock()
        fake.du.return_value=R.BUDGET_BYTES-10
        fake.exists.return_value=False
        with patch.dict(os.environ,{"BIOTEX_R2_ENABLED":"1"}):
            with self.assertRaises(R.ArchiveUnavailable):
                R.archive_original(self.source,fs=fake)
        fake.put_file.assert_not_called()

    def test_single_verified_private_write(self):
        fake=MagicMock()
        fake.du.return_value=1200
        fake.exists.return_value=False
        fake.info.return_value={"size":self.source.stat().st_size}
        with patch.dict(os.environ,{"BIOTEX_R2_ENABLED":"1"}):
            result=R.archive_original(self.source,fs=fake)
        self.assertEqual(result["status"],"archived")
        self.assertTrue(result["private"])
        self.assertIn("terra360-nasa-archive/scientific/gpm-imerg/",result["key"])
        fake.put_file.assert_called_once()

    def test_existing_object_is_not_reuploaded(self):
        fake=MagicMock()
        fake.du.return_value=1400
        fake.exists.return_value=True
        with patch.dict(os.environ,{"BIOTEX_R2_ENABLED":"1"}):
            result=R.archive_original(self.source,fs=fake)
        self.assertEqual(result["status"],"already_archived")
        fake.put_file.assert_not_called()

    def test_unrecognised_file_is_rejected(self):
        path=Path(self.tmp.name)/"unexpected.bin"
        path.write_bytes(b"not NASA")
        with self.assertRaises(R.ArchiveUnavailable):
            R.validate_local_scientific_file(path)


if __name__=="__main__":
    unittest.main()
