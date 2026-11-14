#!/usr/bin/env python3
"""Bounded, authenticated NASA GPM originals and SMAP Calca-native-cell archive.

NASA SMAP V006 is far larger than the per-object R2 budget. An original
is verified in a temporary GitHub Actions directory, its original SHA
recorded, and only a native-grid AM regional HDF5 extract stored privately.
GPM remains an unchanged verified original NetCDF.
"""
from __future__ import annotations

import argparse
from datetime import date, timedelta
from pathlib import Path
import os
import tempfile

import earthaccess

from app.services.smap_subset import create_calca_native_subset
from app.services.verified_archive import (
    ArchiveError, MAX_GRANULE_BYTES, MAX_SMAP_SOURCE_BYTES, PRODUCTS, settings,
    client, _read_manifest, upload_verified, verify_name,
)


def _declared_smap_bytes(granule: dict, candidate_names: list[str]) -> int | None:
    """Read per-file NASA CMR UMM-G size, when available (never an estimate)."""
    umm = granule.get("umm") or {}
    info = (umm.get("DataGranule") or {}).get("ArchiveAndDistributionInformation") or []
    for item in info:
        if not isinstance(item, dict):
            continue
        name = Path(str(item.get("Name") or "")).name
        if name not in candidate_names or not name.endswith(".h5"):
            continue
        try:
            if item.get("SizeInBytes") is not None:
                size = int(item["SizeInBytes"])
            else:
                unit = str(item.get("SizeUnit") or "").upper()
                unit_multiplier = {"KB": 1000, "MB": 1000 ** 2, "GB": 1000 ** 3}
                if unit not in unit_multiplier:
                    continue
                size = int(float(item["Size"]) * unit_multiplier[unit])
            return size if size > 0 else None
        except (ValueError, TypeError, KeyError):
            continue
    return None


def _valid_name(product: str, target: date, value: str) -> bool:
    try:
        verify_name(product, target, value)
        return True
    except ArchiveError:
        return False


def ingest_one(product: str, target: date) -> dict:
    """Ingest at most one granule per product/date, within strict cloud quotas."""
    if product not in PRODUCTS:
        raise ValueError("Unrecognized NASA product")
    if target >= date.today() - timedelta(days=1) or target < date.today() - timedelta(days=365):
        raise ValueError("Date must be 2–365 days in the past")
    config = settings()
    if config is None:
        raise ArchiveError("Set TERRA_OBJECT_BUCKET and private S3/R2 keys first.")
    s3 = client(config)
    if _read_manifest(s3, config, product, target) is not None:
        return {"status": "already_verified", "product": product, "date": target.isoformat()}
    if not (os.getenv("EARTHDATA_TOKEN") or
            (os.getenv("EARTHDATA_USERNAME") and os.getenv("EARTHDATA_PASSWORD"))):
        raise ArchiveError("Missing Earthdata private authentication environment.")
    auth = earthaccess.login(strategy="environment", persist=False)
    if not auth.authenticated:
        raise ArchiveError("Earthdata authentication rejected")
    version = "07" if product == "gpm" else "006"
    granules = earthaccess.search_data(short_name=PRODUCTS[product],
                                       version=version,
                                       temporal=(target.isoformat(), target.isoformat()),
                                       count=3)
    if not granules:
        return {"status": "no_official_granule", "product": product,
                "date": target.isoformat()}
    with tempfile.TemporaryDirectory(prefix="terra-nasa-ingest-") as directory:
        for granule in granules[:3]:
            links = granule.get("umm", {}).get("RelatedUrls", [])
            names = [Path(str(item.get("URL", "")).split("?", 1)[0]).name
                     for item in links if item.get("Type") == "GET DATA"]
            matching_names = [name for name in names if _valid_name(product, target, name)]
            if not matching_names:
                continue
            if product == "smap":
                declared_size = _declared_smap_bytes(granule, matching_names)
                if declared_size is not None and declared_size > MAX_SMAP_SOURCE_BYTES:
                    return {"status": "source_exceeds_temporary_limit",
                            "product": product, "date": target.isoformat(),
                            "declared_bytes": declared_size,
                            "max_temporary_bytes": MAX_SMAP_SOURCE_BYTES}
            downloaded = earthaccess.download(
                [granule], local_path=directory, show_progress=False,
            )
            for filename in downloaded or []:
                original = Path(filename).resolve()
                if original.parent != Path(directory).resolve():
                    raise ArchiveError("NASA downloader returned a path outside staging dir.")
                if not _valid_name(product, target, original.name):
                    continue
                source_size = original.stat().st_size
                source_cap = MAX_SMAP_SOURCE_BYTES if product == "smap" else MAX_GRANULE_BYTES
                if not 1 <= source_size <= source_cap:
                    return {"status": "source_exceeds_temporary_limit",
                            "product": product, "date": target.isoformat(),
                            "downloaded_bytes": source_size,
                            "max_temporary_bytes": source_cap}
                granule_id = (granule.get("meta") or {}).get("concept-id")
                if not isinstance(granule_id, str) or not granule_id.startswith("G"):
                    raise ArchiveError("El granule no tiene identificador oficial NASA CMR.")
                if product == "gpm":
                    import xarray as xr
                    with xr.open_dataset(original, engine="h5netcdf") as ds:
                        if "precipitation" not in ds or not {"time", "lon", "lat"}.issubset(ds.dims):
                            raise ArchiveError("NASA GPM missing original science variable.")
                    return {"status": "ingested", **upload_verified(
                        product, target, original, source_id=granule_id,
                    )}
                derived = Path(directory) / "calca-native-grid" / original.name
                source_metadata = create_calca_native_subset(original, derived)
                if source_metadata is None:
                    return {"status": "no_local_am_coverage", "product": product,
                            "date": target.isoformat(),
                            "representation": "native_9km_SMAP_AM_grid_no_observation"}
                result = upload_verified(
                    product, target, derived, source_id=granule_id,
                    source_metadata=source_metadata,
                )
                return {"status": "ingested", "representation": "regional_native_grid_subset",
                        "original_size_bytes": source_size, **result}
        return {"status": "no_matching_granule", "product": product,
                "date": target.isoformat()}


def main():
    parser = argparse.ArgumentParser(description="Private NASA Earthdata ingest for Calca")
    parser.add_argument("--product", choices=("gpm", "smap"), required=True)
    parser.add_argument("--lag-days", type=int, default=7)
    args = parser.parse_args()
    if not 2 <= args.lag_days <= 30:
        parser.error("lag-days must be between 2 and 30")
    target = date.today() - timedelta(days=args.lag_days)
    # No secrets, object URLs, object keys or signed NASA links in output.
    import json
    print(json.dumps(ingest_one(args.product, target), ensure_ascii=False))


if __name__ == "__main__":
    main()
