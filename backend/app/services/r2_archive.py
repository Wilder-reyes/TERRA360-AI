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
    # Free GB-month is account-wide. Refuse uploads unless usage of EVERY
    # bucket can be measured. This still cannot inspect Cloudflare operation
    # charges or other concurrent writers and is not a billing guarantee.
    try:
        buckets=[str(x).strip("/") for x in fs.ls("",detail=False)]
        if not buckets or bucket not in buckets or len(buckets)>10:
            raise ArchiveUnavailable("R2 bucket inventory unavailable or too large to review safely.")
        sizes={name:int(fs.du(name,total=True)) for name in buckets}
    except ArchiveUnavailable:
        raise
    except Exception as exc:
        raise ArchiveUnavailable("Cannot verify account-wide R2 usage; no upload performed.") from exc
    if any(v<0 for v in sizes.values()):
        raise ArchiveUnavailable("Invalid account usage; no upload performed.")
    account_used=sum(sizes.values())
    if account_used>BUDGET_BYTES:
        raise ArchiveUnavailable("All R2 buckets together exceed the 8 GB guard.")
    if fs.exists(dest):
        return {"status":"already_archived","key":dest,"object_bytes":size,
                "bucket_used_bytes":sizes[bucket],"account_used_bytes":account_used,"private":True}
    if account_used+size>BUDGET_BYTES:
        raise ArchiveUnavailable("Account-wide R2 safety budget exceeded; no upload performed.")
    # R2 Cloudflare still separately charges Class A/B requests. Enable only
    # after checking the billing dashboard and credentials privately.
    fs.put_file(str(path),dest)
    if int(fs.info(dest).get("size",-1))!=size:
        raise ArchiveUnavailable("Remote size differs from the local source.")
    return {"status":"archived","key":dest,"object_bytes":size,
            "bucket_used_bytes":sizes[bucket]+size,
            "account_used_bytes":account_used+size,"private":True}
