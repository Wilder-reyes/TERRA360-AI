"""Explicit, one-file-at-a-time private NASA R2 uploader.

Usage:
  python scripts/archive_nasa_r2.py backend/data/gpm/<original-granule.nc4>
Requires BIOTEX_R2_ENABLED=1 and private R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/
R2_SECRET_ACCESS_KEY in environment. Files are never made public.
"""
from pathlib import Path
import argparse
import json
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"backend"))
from app.services.r2_archive import archive_original,validate_local_scientific_file,ArchiveUnavailable

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("path",help="An original NASA .nc4 or .h5 under backend/data")
    p.add_argument("--dry-run",action="store_true",help="Validate local file only; no network or upload")
    args=p.parse_args()
    try:
        if args.dry_run:
            path,size,kind=validate_local_scientific_file(args.path)
            print(json.dumps({"status":"local_preflight_only","file":path.name,"bytes":size,"kind":kind,
                  "warning":"R2 bucket size has NOT been checked. No upload was attempted."}))
        else:
            print(json.dumps(archive_original(args.path),ensure_ascii=False))
    except (ArchiveUnavailable,OSError) as e:
        sys.exit(str(e))
