"""Opt-in private Cloudflare R2 archive for verified original NASA files.
8 GB decimal guard below the 10 GB-month free allowance (not a billing guarantee).
Uploads are never exposed as an HTTP API or enabled by default.
"""
from __future__ import annotations
import hashlib
import os
from pathlib import Path

BUCKET = "terra360-nasa-archive"
BUDGET_BYTES = 8_000_000_000
MAX_OBJECT_BYTES = 60_000_000
ALLOWED_ROOT = Path(__file__).resolve().parents[2] / "data"
ALLOWED_FORMATS = {".nc4": "gpm-imerg", ".h5": "smap"}

class ArchiveUnavailable(RuntimeError):
    pass

def validate_local_scientific_file(local_path: str | Path) -> tuple[Path,int,str]:
    path=Path(local_path).expanduser().resolve(strict=True)
    if not path.is_file() or not path.is_relative_to(ALLOWED_ROOT.resolve()):
        raise ArchiveUnavailable("Only files inside backend/data may be archived.")
    if path.suffix.lower() not in ALLOWED_FORMATS:
        raise ArchiveUnavailable("Only original NASA .nc4 or .h5 files are accepted.")
    kind=ALLOWED_FORMATS[path.suffix.lower()]
    if kind=="gpm-imerg" and "3IMERG" not in path.name:
        raise ArchiveUnavailable("Unrecognised GPM IMERG granule filename.")
    if kind=="smap" and not path.name.upper().startswith(("SMAP_","SPL")):
        raise ArchiveUnavailable("Unrecognised NASA SMAP granule filename.")
    size=path.stat().st_size
    if not 0<size<=MAX_OBJECT_BYTES:
        raise ArchiveUnavailable("File exceeds 60 MB single-object cap.")
    return path,size,kind

def remote_key(path:Path,kind:str)->str:
    h=hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda:stream.read(1024*1024),b""):
            h.update(block)
    return f"scientific/{kind}/{h.hexdigest()[:24]}-{path.name}"

def archive_original(local_path: str | Path, *, fs=None) -> dict:
    """Only one source object per explicit call; no automatic upload."""
    if os.getenv("BIOTEX_R2_ENABLED","0")!="1":
        raise ArchiveUnavailable("R2 is disabled: set BIOTEX_R2_ENABLED=1 after review.")
    path,size,kind=validate_local_scientific_file(local_path)
    if fs is None:
        account=os.getenv("R2_ACCOUNT_ID","").strip()
        access=os.getenv("R2_ACCESS_KEY_ID","").strip()
        secret=os.getenv("R2_SECRET_ACCESS_KEY","").strip()
        if not (account and access and secret):
            raise ArchiveUnavailable("Private R2 credentials are not configured.")
        import s3fs
        fs=s3fs.S3FileSystem(key=access,secret=secret,client_kwargs={
            "endpoint_url":f"https://{account}.r2.cloudflarestorage.com"})
    bucket=os.getenv("R2_BUCKET",BUCKET)
    if bucket!=BUCKET:
        raise ArchiveUnavailable("Unexpected bucket; only terra360-nasa-archive is allowed.")
    dest=f"{bucket}/{remote_key(path,kind)}"
    used=int(fs.du(bucket,total=True))
    if used<0 or used>BUDGET_BYTES:
        raise ArchiveUnavailable("Cannot verify bucket usage within the 8 GB guard.")
    if fs.exists(dest):
        return {"status":"already_archived","key":dest,"object_bytes":size,
                "bucket_used_bytes":used,"private":True}
    if used+size>BUDGET_BYTES:
        raise ArchiveUnavailable("R2 safety budget exceeded; no upload performed.")
    fs.put_file(str(path),dest)
    if int(fs.info(dest).get("size",-1))!=size:
        raise ArchiveUnavailable("Remote size differs from the local source.")
    return {"status":"archived","key":dest,"object_bytes":size,
            "bucket_used_bytes":used+size,"private":True}
