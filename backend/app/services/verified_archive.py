"""Private durable S3-compatible NASA granule archive with integrity and quotas.

R2/S3 keys are configured ONLY as Render/GitHub secrets. Public API callers
cannot supply object keys, download NASA objects, or trigger ingestion.
"""
from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
from datetime import date, datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
from typing import Iterator

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError, BotoCoreError

PREFIX = "terra360-nasa-v1"
PRODUCTS = {"gpm": "GPM_3IMERGDL", "smap": "SPL3SMP_E"}
MAX_GRANULE_BYTES = 65 * 1024 * 1024
MAX_FILES = 32
MAX_ARCHIVE_BYTES = 1024 * 1024 * 1024  # 1 GiB before ingest must evict explicitly
FILENAME = {
    "gpm": re.compile(r"3B-DAY-L\.MS\.MRG\.3IMERG\.(\d{8})-S000000-E235959\.[A-Za-z0-9_.-]+\.nc4$"),
    "smap": re.compile(r"SMAP_L3_SM_P_E_(\d{8})_[A-Za-z0-9_.-]+\.h5$"),
}


class ArchiveError(RuntimeError):
    pass


@dataclass(frozen=True)
class StorageConfig:
    bucket: str
    endpoint: str | None
    region: str


def settings() -> StorageConfig | None:
    bucket = os.getenv("TERRA_OBJECT_BUCKET", "").strip()
    if not bucket:
        return None
    if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9.\-]{2,62}", bucket):
        raise ArchiveError("Nombre de bucket inválido.")
    endpoint = os.getenv("TERRA_OBJECT_ENDPOINT", "").strip() or None
    if endpoint and (not endpoint.startswith("https://") or
                     "@" in endpoint or "?" in endpoint or "#" in endpoint):
        raise ArchiveError("El almacenamiento requiere endpoint HTTPS confiable.")
    return StorageConfig(bucket=bucket, endpoint=endpoint,
                         region=os.getenv("TERRA_OBJECT_REGION", "auto"))


def client(config: StorageConfig):
    return boto3.client("s3", region_name=config.region,
                        endpoint_url=config.endpoint,
                        config=Config(signature_version="s3v4",
                                      retries={"max_attempts": 2},
                                      connect_timeout=4, read_timeout=20))


def object_keys(product: str, target: date) -> tuple[str, str]:
    if product not in PRODUCTS:
        raise ValueError("Producto satelital no permitido.")
    if not isinstance(target, date):
        raise ValueError("Fecha inválida.")
    base = f"{PREFIX}/{product}/{target:%Y/%m/%d}"
    return base + "/granule", base + "/manifest.json"


def verify_name(product: str, target: date, name: str):
    if not isinstance(name, str) or Path(name).name != name:
        raise ArchiveError("Nombre de granule no permitido.")
    match = FILENAME[product].fullmatch(name)
    if not match or match.group(1) != target.strftime("%Y%m%d"):
        raise ArchiveError("El archivo no coincide con producto/fecha.")
    return name


def validate_manifest(product: str, target: date, manifest: dict) -> None:
    if (manifest.get("product") != PRODUCTS[product] or
        manifest.get("date") != target.isoformat() or
        not isinstance(manifest.get("sha256"), str) or
        not re.fullmatch(r"[a-f0-9]{64}", manifest["sha256"]) or
        type(manifest.get("size_bytes")) is not int or
        not 1 <= manifest["size_bytes"] <= MAX_GRANULE_BYTES or
        manifest.get("verified_format") != "NASA-original-granule"):
        raise ArchiveError("El manifiesto NASA no pasó integridad estructural.")
    verify_name(product, target, manifest.get("filename"))


def _read_manifest(s3, config: StorageConfig, product: str, target: date):
    _, manifest_key = object_keys(product, target)
    try:
        body = s3.get_object(Bucket=config.bucket, Key=manifest_key)["Body"].read(8192)
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") in ("NoSuchKey", "404"):
            return None
        raise ArchiveError("No fue posible leer el índice privado NASA.") from exc
    try:
        manifest = json.loads(body)
    except (TypeError, ValueError) as exc:
        raise ArchiveError("Índice NASA corrupto.") from exc
    if not isinstance(manifest, dict):
        raise ArchiveError("Índice NASA inválido.")
    validate_manifest(product, target, manifest)
    return manifest


@contextmanager
def staged_granule(product: str, target: date) -> Iterator[Path | None]:
    """Yield a temporary verified file. Never persist under Render Free disk."""
    config = settings()
    if config is None:
        yield None
        return
    s3 = client(config)
    manifest = _read_manifest(s3, config, product, target)
    if manifest is None:
        yield None
        return
    data_key, _ = object_keys(product, target)
    try:
        head = s3.head_object(Bucket=config.bucket, Key=data_key)
        if head["ContentLength"] != manifest["size_bytes"]:
            raise ArchiveError("Tamaño del granule no coincide con manifiesto.")
    except ClientError as exc:
        raise ArchiveError("Granule almacenado ausente o inaccesible.") from exc
    with tempfile.TemporaryDirectory(prefix="terra-nasa-") as directory:
        path = Path(directory) / manifest["filename"]
        checksum = hashlib.sha256()
        size = 0
        try:
            response = s3.get_object(Bucket=config.bucket, Key=data_key)
            with path.open("wb") as output:
                for block in response["Body"].iter_chunks(chunk_size=256 * 1024):
                    if not block:
                        continue
                    size += len(block)
                    if size > MAX_GRANULE_BYTES:
                        raise ArchiveError("Granule supera límite de descarga.")
                    checksum.update(block)
                    output.write(block)
        except (ClientError, BotoCoreError) as exc:
            raise ArchiveError("Error de lectura de almacenamiento NASA.") from exc
        if size != manifest["size_bytes"] or checksum.hexdigest() != manifest["sha256"]:
            raise ArchiveError("Checksum NASA no coincide; dato rechazado.")
        yield path


def _archive_usage(s3, config: StorageConfig) -> tuple[int, int]:
    count = total = 0
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=config.bucket, Prefix=PREFIX + "/"):
        for entry in page.get("Contents", []):
            # Object listing must be bounded against runaway archives.
            count += 1
            total += entry["Size"]
            if count > MAX_FILES * 2 + 8 or total > MAX_ARCHIVE_BYTES:
                raise ArchiveError("Cuota de objetos NASA excedida.")
    return count, total


def upload_verified(product: str, target: date, path: Path, *, source_id: str):
    """Private offline ingestion only; use one verified original granule per day."""
    if product not in PRODUCTS:
        raise ValueError("Producto no permitido.")
    verify_name(product, target, path.name)
    size = path.stat().st_size
    if not 1 <= size <= MAX_GRANULE_BYTES:
        raise ArchiveError("Granule excede límite de tamaño (65 MiB).")
    if not source_id or len(source_id) > 250 or any(c in source_id for c in "\r\n"):
        raise ArchiveError("Identificador Earthdata de procedencia no válido.")
    config = settings()
    if config is None:
        raise ArchiveError("No hay almacenamiento de objetos persistente configurado.")
    s3 = client(config)
    existing = _read_manifest(s3, config, product, target)
    if existing is not None:
        raise ArchiveError("La fecha ya está archivada; ingesta inmutable.")
    count, total = _archive_usage(s3, config)
    if count // 2 >= MAX_FILES or total + size > MAX_ARCHIVE_BYTES:
        raise ArchiveError("Cuota privada excedida: máx. 32 granules y 1 GiB.")
    sha = hashlib.sha256()
    with path.open("rb") as input_file:
        for chunk in iter(lambda: input_file.read(1024 * 1024), b""):
            sha.update(chunk)
    manifest = {
        "product": PRODUCTS[product],
        "date": target.isoformat(),
        "filename": path.name,
        "size_bytes": size,
        "sha256": sha.hexdigest(),
        "source_id": source_id,
        "verified_format": "NASA-original-granule",
        "ingested_at": datetime.now(timezone.utc).isoformat(),
    }
    data_key, manifest_key = object_keys(product, target)
    s3.upload_file(str(path), config.bucket, data_key, ExtraArgs={
        "ContentType": "application/octet-stream",
        "Metadata": {"sha256": manifest["sha256"]},
    })
    s3.put_object(Bucket=config.bucket, Key=manifest_key,
                  Body=json.dumps(manifest, sort_keys=True).encode(),
                  ContentType="application/json")
    return {k: manifest[k] for k in ("product", "date", "size_bytes", "sha256")}


def prune_expired(*, keep_days: int = 14, today: date | None = None) -> dict:
    """Controlled retention for NASA archive. Never touches unknown S3 keys.

    Only paths produced by object_keys() are eligible, and only dates strictly
    older than the retention window. Call in a private ingestion workflow,
    never an HTTP request. All storage is operator-owned.
    """
    from datetime import timedelta
    if not 7 <= keep_days <= 30:
        raise ValueError("Retención admitida: 7–30 días.")
    config = settings()
    if config is None:
        raise ArchiveError("El almacenamiento privado no está configurado.")
    s3 = client(config)
    cutoff = (today or date.today()) - timedelta(days=keep_days)
    groups: dict[tuple[str, date], set[str]] = {}
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=config.bucket, Prefix=PREFIX + "/"):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            parts = key.split("/")
            if len(parts) != 6 or parts[0] != PREFIX or parts[1] not in PRODUCTS or (
                parts[5] not in ("manifest.json","granule")):
                continue
            try:
                target = date(int(parts[2]), int(parts[3]), int(parts[4]))
            except ValueError:
                continue
            if target >= cutoff:
                continue
            groups.setdefault((parts[1], target), set()).add(parts[5])
    deleted_dates = 0
    for (product, target), present in sorted(groups.items(), key=lambda x:x[0][1]):
        data_key, manifest_key = object_keys(product, target)
        keys = [data_key if name == "granule" else manifest_key for name in present]
        if not keys:
            continue
        s3.delete_objects(Bucket=config.bucket,
                          Delete={"Objects":[{"Key":k} for k in keys], "Quiet":True})
        deleted_dates += 1
    return {"deleted_archive_dates":deleted_dates,"retention_days":keep_days,
            "cutoff":cutoff.isoformat(),"scope":PREFIX}
