"""Read pinned FAO GAEZ v5 original GeoTIFF: RAW index class code only.

A 5-arcminute (~9 km at equator) source cell is not a plot measurement.
The FAO dataset catalog publishes CC BY 4.0; specific asset terms remain
subject to the source. Never infer agronomic suitability from this raw code.
"""
from __future__ import annotations

from hashlib import sha256
from math import isfinite
import os
from pathlib import Path
import tempfile
import threading
import time

import httpx
import rasterio

from app.services.gaez_selected import (
    OFFICIAL_FILENAME, OFFICIAL_SHA256, OFFICIAL_BYTES,
    OFFICIAL_CRS, OFFICIAL_NODATA, OFFICIAL_RESOLUTION_DEG,
    SOURCE_URL, selected_metadata,
)
from app.services.sentinel_ndvi import validate_parcel

OFFICIAL_HTTP_URL = (
    "https://storage.googleapis.com/fao-gismgr-gaez-v5-data/"
    "DATA/GAEZ-V5/MAPSET/RES05-SIX/" + OFFICIAL_FILENAME
)
CATALOG_DATASET_URL = (
    "https://data.apps.fao.org/catalog/dataset/"
    "514c92d5-9e01-4c70-814a-80ea1ca9fe6a"
)
DATASET_LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"
MAX_SIZE = 1024 * 1024
FAILED_RETRY_DELAY = 90
_LOCK = threading.RLock()
_last_failure: float | None = None


class GAEZOriginalError(RuntimeError):
    pass


def _verified_tiff(path: Path) -> bool:
    """Reject stale/modified data; no file name alone establishes provenance."""
    if not path.is_file() or path.stat().st_size != OFFICIAL_BYTES:
        return False
    checksum=sha256()
    with path.open("rb") as input_file:
        for chunk in iter(lambda: input_file.read(256*1024), b""):
            checksum.update(chunk)
    return checksum.hexdigest() == OFFICIAL_SHA256


def _cached_source_path() -> Path:
    global _last_failure
    filename = "terra360-fao-gaez-v5-"+OFFICIAL_SHA256[:18]+".tif"
    path=Path(tempfile.gettempdir())/filename
    with _LOCK:
        if _verified_tiff(path):
            return path
        if (_last_failure is not None and
                time.monotonic()-_last_failure < FAILED_RETRY_DELAY):
            raise GAEZOriginalError("FAO original is temporarily unavailable; retry later.")
        temp_path = path.with_name(path.name+".part")
        try:
            # The ONLY allowed upstream URL is a compile-time literal. Neither
            # the polygon nor any input field is interpolated into the request.
            with httpx.Client(timeout=httpx.Timeout(25.0,connect=6.0),
                              follow_redirects=False) as client:
                with client.stream("GET", OFFICIAL_HTTP_URL) as response:
                    response.raise_for_status()
                    if response.status_code != 200:
                        raise GAEZOriginalError("FAO original raster status is not 200.")
                    length=response.headers.get("content-length")
                    if length is not None and int(length) != OFFICIAL_BYTES:
                        raise GAEZOriginalError("FAO object length differs from pinned generation.")
                    checksum=sha256()
                    size=0
                    with temp_path.open("wb") as target:
                        for block in response.iter_bytes(chunk_size=64*1024):
                            size+=len(block)
                            if size>MAX_SIZE:
                                raise GAEZOriginalError("FAO source exceeded maximum size.")
                            checksum.update(block)
                            target.write(block)
            if size!=OFFICIAL_BYTES or checksum.hexdigest()!=OFFICIAL_SHA256:
                raise GAEZOriginalError("FAO source SHA-256 does not match verified original.")
            os.replace(temp_path,path)
            return path
        except (httpx.HTTPError, ValueError, OSError, GAEZOriginalError) as exc:
            _last_failure=time.monotonic()
            raise GAEZOriginalError("The FAO original could not be integrity-verified.") from exc
        finally:
            temp_path.unlink(missing_ok=True)


def inspect_raw_cell(path: Path, raw_polygon: dict) -> dict:
    """Read one ORIGINAL grid cell without computing/calling it suitability."""
    polygon, area=validate_parcel(raw_polygon)
    raw=None
    point=polygon.representative_point()
    try:
        with rasterio.open(path) as src:
            if (src.driver!="GTiff" or src.count!=1 or
                str(src.crs)!=OFFICIAL_CRS or
                src.width!=4320 or src.height!=2160 or
                src.nodata!=OFFICIAL_NODATA or
                any(abs(abs(res)-OFFICIAL_RESOLUTION_DEG)>1e-8 for res in src.res)):
                raise GAEZOriginalError("Official FAO raster geometry differs from verified source.")
            if not (src.bounds.left <= point.x < src.bounds.right and
                    src.bounds.bottom < point.y <= src.bounds.top):
                return _result("outside_raster_coverage", None,area,None,None)
            row,col=src.index(point.x,point.y)
            raw=float(src.read(1,window=((row,row+1),(col,col+1)))[0,0])
            if not isfinite(raw) or raw == src.nodata:
                return _result("official_raster_nodata",None,area,None,None)
            x,y=src.xy(row,col)
            bounds=rasterio.windows.bounds(
                rasterio.windows.Window(col,row,1,1),src.transform
            )
            return _result("raw_code_available",int(raw),area,[x,y],list(bounds))
    except (rasterio.errors.RasterioError, OSError) as exc:
        raise GAEZOriginalError("Official FAO GeoTIFF cannot be read.") from exc


def _result(status: str, raw_class_code: int | None, area_m2: float,
            center: list | None, bounds: list | None) -> dict:
    meta=selected_metadata()
    return {
        **meta,
        "status":status,
        "source_raster_url":OFFICIAL_HTTP_URL,
        "source_dataset_metadata":CATALOG_DATASET_URL,
        "source_dataset_license":"CC BY 4.0",
        "source_dataset_license_url":DATASET_LICENSE_URL,
        "source_attribution":"FAO/IIASA GAEZ v5, RES05-SIX / CSV / HP0120 / AGERA5 / HIST / LRLM",
        "raster_sha256":OFFICIAL_SHA256,
        "original_cell_class_code":raw_class_code,
        "native_grid_resolution_degrees":OFFICIAL_RESOLUTION_DEG,
        "cell_center_lon_lat":center,
        "cell_bounds_lon_lat":bounds,
        "declared_area_ha_approx":round(area_m2/10000,3),
        "suitability_index":None,
        "region_suitability_evaluated":False,
        "can_recommend_crop":False,
        "used_in_crop_decision":False,
        "interpretation_status":"uninterpreted_original_class_code",
        "limitations":[
            "El código bruto NO es un porcentaje, rendimiento ni diagnóstico de cultivo.",
            "La celda GAEZ de 5 minutos de arco representa una región, no un terreno individual.",
            "El periodo histórico 2001–2020 NO describe las condiciones agrícolas actuales de una parcela.",
            "No se usa para recomendaciones ARIE; verificar interpretación de clases y observaciones locales.",
        ],
    }


def selected_original_cell(raw_polygon: dict) -> dict:
    # Validation BEFORE external network access prevents anonymous malformed
    # inputs from triggering upstream egress.
    validate_parcel(raw_polygon)
    return inspect_raw_cell(_cached_source_path(),raw_polygon)
