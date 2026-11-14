#!/usr/bin/env python3
"""Inspect actual FAO GAEZ v5 RES05-SIX GeoTIFF on ephemeral GitHub Actions.

Requires verified inventory row and public HTTP 200 for its exact file.
Records *raw* pixels, shape, resolution, CRS, no-data and SHA-256.
Never publishes crop suitability from raw stored integers without confirmed
scale and legal conditions. No GeoTIFF is committed or deployed.
"""
from __future__ import annotations
from hashlib import sha256
import json
from pathlib import Path
import sys
import tempfile

import numpy as np
import rasterio
import requests
from pyproj import Transformer
if __package__:
    from scripts.verify_gaez_res05_official import (
        VerificationError, download_inventory, read_catalog, select_one,
        check_official_object
    )
else:
    from verify_gaez_res05_official import (
        VerificationError, download_inventory, read_catalog, select_one,
        check_official_object
    )

MAX_TIFF_BYTES = 12 * 1024 * 1024
CALCA_REFERENCE = (-71.95605,-13.32175)


def inspect_raster(path: Path, record: dict) -> dict:
    checksum = sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(262144), b""):
            checksum.update(chunk)
    with rasterio.open(path) as src:
        if src.count != 1 or src.crs is None or src.width <= 0 or src.height <= 0:
            raise VerificationError("FAO TIFF has no verified single-band georeferencing")
        if src.crs.is_geographic and (
            abs(src.res[0]) > 1 or abs(src.res[1]) > 1
        ):
            raise VerificationError("FAO raster has unexpectedly coarse spatial scale")
        x,y=Transformer.from_crs("EPSG:4326",src.crs,always_xy=True).transform(*CALCA_REFERENCE)
        near=src.bounds.left<=x<src.bounds.right and src.bounds.bottom<y<=src.bounds.top
        raw=None
        if near:
            row,col=src.index(x,y)
            raw=float(src.read(1,window=((row,row+1),(col,col+1)),masked=False)[0,0])
        nodata=src.nodata
        is_valid=near and raw is not None and np.isfinite(raw) and (
            nodata is None or raw != nodata
        )
        return {
            **record,
            "tiff_sha256":checksum.hexdigest(),
            "tiff_bytes":path.stat().st_size,
            "driver":src.driver,
            "width":src.width, "height":src.height,
            "count":src.count,
            "crs":str(src.crs),
            "native_resolution":list(src.res),
            "bounds":list(src.bounds),
            "pixel_type":src.dtypes[0],
            "nodata":nodata,
            "rasterio_scale":src.scales[0],
            "rasterio_offset":src.offsets[0],
            "band_unit":src.units[0],
            "dataset_tag_keys":sorted(list(src.tags().keys()))[:24],
            "calca_reference_lon_lat":list(CALCA_REFERENCE),
            "calca_reference_raw_pixel":raw if is_valid else None,
            "calca_reference_status":("raw_pixel_not_interpreted" if is_valid
                                      else "outside_coverage_or_nodata"),
            "suitability_index":None,
            "scale_semantics_verified":False,
            "exact_asset_license_verified":False,
            "used_in_crop_decision":False,
        }


def inspect_remote(record: dict) -> dict:
    if not record.get("public_object_verified"):
        raise VerificationError("FAO GeoTIFF HEAD verification did not pass")
    size=record.get("content_length_bytes")
    if not isinstance(size,int) or not 0<size<=MAX_TIFF_BYTES:
        raise VerificationError("FAO GeoTIFF is missing, empty or over 12 MiB")
    with tempfile.TemporaryDirectory(prefix="terra-fao-") as directory:
        path=Path(directory)/record["file_name"]
        total=0
        try:
            with requests.get(record["url"],stream=True,timeout=(9,40),
                              allow_redirects=False) as response:
                response.raise_for_status()
                with path.open("wb") as output:
                    for chunk in response.iter_content(262144):
                        if not chunk: continue
                        total+=len(chunk)
                        if total>MAX_TIFF_BYTES:
                            raise VerificationError("Downloaded FAO TIFF exceeds 12 MiB")
                        output.write(chunk)
        except requests.RequestException as exc:
            raise VerificationError("FAO GeoTIFF download is unavailable") from exc
        if total!=size:
            raise VerificationError("FAO object changed or was truncated during inspection")
        return inspect_raster(path,record)


def main():
    try:
        selection=select_one(read_catalog(download_inventory()))
        metadata=check_official_object(selection)
        report=inspect_remote(metadata)
    except (VerificationError,ValueError,rasterio.errors.RasterioError) as exc:
        print("FAO_RASTER_NOT_VERIFIED: "+str(exc),file=sys.stderr)
        return 2
    print("FAO_REAL_GEOTIFF_INSPECTED_NOT_AGRONOMICALLY_INTERPRETED")
    print(json.dumps(report,indent=2,sort_keys=True,ensure_ascii=False,allow_nan=False))
    Path("fao-v5-res05-sample-inspection.json").write_text(
        json.dumps(report,indent=2,sort_keys=True,ensure_ascii=False,allow_nan=False)
        +"\n",encoding="utf-8")
    return 0


if __name__=="__main__":
    raise SystemExit(main())
