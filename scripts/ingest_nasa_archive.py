#!/usr/bin/env python3
"""Bounded offline NASA Earthdata -> private S3/R2 ingestion (never an API route).

Example (credentials via environment secrets, not CLI flags):
  PYTHONPATH=backend python scripts/ingest_nasa_archive.py --product gpm --lag-days 7
  PYTHONPATH=backend python scripts/ingest_nasa_archive.py --product smap --lag-days 7
"""
from __future__ import annotations
import argparse
from datetime import date, timedelta
from pathlib import Path
import os
import tempfile

import earthaccess
from app.services.verified_archive import (
    ArchiveError, MAX_GRANULE_BYTES, PRODUCTS, object_keys, settings,
    client, _read_manifest, upload_verified, verify_name,
)


def ingest_one(product: str, target: date) -> dict:
    """At most ONE product/day and max 65 MiB. Never retries until upload succeeds."""
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
            # CMR metadata names differ by DAAC: never trust without filename check.
            links = granule.get("umm", {}).get("RelatedUrls", [])
            names = [Path(str(x.get("URL","")).split("?",1)[0]).name for x in links
                     if x.get("Type") == "GET DATA"]
            if not any(_valid_name(product, target, name) for name in names):
                continue
            downloaded = earthaccess.download([granule], local_path=directory, show_progress=False)
            for filename in downloaded or []:
                path = Path(filename).resolve()
                if path.parent != Path(directory).resolve():
                    raise ArchiveError("NASA downloader returned a path outside staging dir.")
                if not _valid_name(product, target, path.name):
                    continue
                if path.stat().st_size > MAX_GRANULE_BYTES:
                    raise ArchiveError("NASA download exceeds 65 MiB limit.")
                # Minimal scientific structural check before publishing an original NASA file.
                if product == "gpm":
                    import xarray as xr
                    with xr.open_dataset(path, engine="h5netcdf") as ds:
                        if "precipitation" not in ds or not {"time","lon","lat"}.issubset(ds.dims):
                            raise ArchiveError("NASA GPM missing original science variable.")
                else:
                    import h5py
                    with h5py.File(path, "r") as h5:
                        g=h5.get("Soil_Moisture_Retrieval_Data_AM")
                        if g is None or any(key not in g for key in (
                            "latitude","longitude","soil_moisture_dca","retrieval_qual_flag_dca"
                        )):
                            raise ArchiveError("NASA SMAP missing original AM DCA measurements.")
                granule_id = (granule.get("meta") or {}).get("concept-id")
                if not isinstance(granule_id, str) or not granule_id.startswith("G"):
                    raise ArchiveError("El granule no tiene identificador oficial NASA CMR.")
                return {"status": "ingested", **upload_verified(
                    product, target, path, source_id=granule_id
                )}
        return {"status": "no_matching_granule", "product": product,
                "date": target.isoformat()}


def _valid_name(product: str, target: date, value: str) -> bool:
    try:
        verify_name(product, target, value)
        return True
    except ArchiveError:
        return False


def main():
    parser = argparse.ArgumentParser(description="Private NASA Earthdata ingest, bounded to one date")
    parser.add_argument("--product", choices=("gpm", "smap"), required=True)
    parser.add_argument("--lag-days", type=int, default=7)
    args = parser.parse_args()
    if not 2 <= args.lag_days <= 30:
        parser.error("lag-days must be between 2 and 30")
    target = date.today() - timedelta(days=args.lag_days)
    # Output contains no secret, S3 key, download link or signed NASA URL.
    import json
    print(json.dumps(ingest_one(args.product, target), ensure_ascii=False))


if __name__ == "__main__":
    main()
