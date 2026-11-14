"""One explicitly selected FAO GAEZ v5 suitability-index dataset.

This registry is REAL source metadata, but no live cell measurement is
available until an exact FAO GeoTIFF, checksum, scale, license and dimensions
have been independently verified and deployed. No invented suitability score.
"""
from __future__ import annotations

from datetime import date
from hashlib import sha256
from math import isfinite
import os
from pathlib import Path
import re

import rasterio
from pyproj import Transformer
from app.services.sentinel_ndvi import validate_parcel

SOURCE_URL = "https://data.fao.org/catalog/dataset/gaez-v5-master-config/resource/31abf121-1644-4473-8c1b-bfec83112749"
METHOD_URL = "https://github.com/un-fao/gaezv5/wiki/21.-GAEZ-v5-Platform-User-Guide"
BUCKET_PREFIX = "gs://fao-gismgr-gaez-v5-data/DATA/GAEZ-V5/MAPSET/RES05-SIX/"
SELECTED = {
    "source": "FAO/IIASA GAEZ v5",
    "source_url": SOURCE_URL,
    "documentation_url": METHOD_URL,
    "variable_code": "RES05-SIX",
    "variable": "Suitability Index",
    "theme": "Suitability and Attainable Yield",
    "period_code": "HP0120",
    "period": "2001–2020 historical",
    "climate_source": "AgERA5",
    "scenario": "HIST",
    "crop_code": "CSV",
    "crop": "Cassava / Manihot esculenta",
    "management_code": "LRLM",
    "management": "Rainfed, low inputs",
    "official_gcs_folder": BUCKET_PREFIX,
    "exact_tiff_object_verified": False,
    "license_for_exact_asset_verified": False,
    "native_resolution_verified": False,
}
FILENAME_PATTERN = re.compile(
    r"GAEZ-V5\.RES05-SIX\.HP0120\.[A-Za-z0-9_-]+\.HIST\.CSV\.LRLM\.tif$",
)


class GAEZError(RuntimeError):
    pass


def selected_metadata() -> dict:
    return {
        **SELECTED,
        "status": "source_selected_raster_not_verified",
        "suitability_index": None,
        "region_suitability_evaluated": False,
        "used_in_crop_decision": False,
        "note": "El catálogo FAO confirma variables y dimensiones, pero el TIFF exacto aún no ha sido verificado ni publicado en TERRA360.",
    }


def selected_raster_sample(raw_polygon: dict) -> dict:
    """Only raster explicitly configured by an operator, never a user URL/path."""
    polygon, area = validate_parcel(raw_polygon)
    result = selected_metadata()
    result["requested_polygon_area_ha_approx"] = round(area / 10000, 3)
    filename = os.getenv("GAEZ5_APPROVED_TIFF", "")
    trusted_sha = os.getenv("GAEZ5_APPROVED_SHA256", "").lower()
    scale_text = os.getenv("GAEZ5_APPROVED_SCALE", "")
    nodata_text = os.getenv("GAEZ5_APPROVED_NODATA", "")
    license_url = os.getenv("GAEZ5_LICENSE_URL", "")
    # A partial operator setup must never show pseudo-suitability.
    if not (filename and trusted_sha and scale_text and nodata_text and license_url):
        return result
    path = Path(filename)
    if (not FILENAME_PATTERN.fullmatch(path.name) or
        not re.fullmatch(r"[a-f0-9]{64}", trusted_sha) or
        not path.is_file() or path.stat().st_size > 2 * 1024 * 1024 * 1024 or
        not license_url.startswith("https://")):
        raise GAEZError("Raster FAO o manifiesto no verificado; consulta rechazada.")
    try:
        scale = float(scale_text)
        nodata = float(nodata_text)
    except ValueError as exc:
        raise GAEZError("Escala o valor sin datos FAO inválidos.") from exc
    if not isfinite(scale) or scale <= 0 or not isfinite(nodata):
        raise GAEZError("Escala FAO no verificada.")
    digest = sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    if digest.hexdigest() != trusted_sha:
        raise GAEZError("SHA-256 del raster GAEZ no coincide; se bloquea su lectura.")
    try:
        with rasterio.open(path) as src:
            if src.crs is None or src.count != 1 or not src.transform.is_rectilinear:
                raise GAEZError("Georreferenciación o bandas GAEZ no verificadas.")
            if src.nodata is None or abs(float(src.nodata) - nodata) > 1e-5:
                raise GAEZError("Valor no-data TIFF distinto al registrado.")
            center = polygon.representative_point()
            x, y = Transformer.from_crs("EPSG:4326", src.crs, always_xy=True).transform(
                center.x, center.y
            )
            if not (src.bounds.left <= x <= src.bounds.right and
                    src.bounds.bottom <= y <= src.bounds.top):
                result["status"] = "outside_raster_coverage"
                return result
            row, col = src.index(x, y)
            sample = float(src.read(1, window=((row,row+1),(col,col+1)))[0,0])
            if not isfinite(sample) or sample == nodata:
                result["status"] = "raster_nodata"
                return result
            # The result remains a coarse grid reading, never a plot-specific
            # planting recommendation, field validation, or observed yield.
            result.update({
                "status": "coarse_raster_cell_available",
                "raster_sha256": trusted_sha,
                "license_url": license_url,
                "native_resolution": [abs(src.res[0]), abs(src.res[1])],
                "native_crs": str(src.crs),
                "exact_tiff_object_verified": True,
                "license_for_exact_asset_verified": True,
                "native_resolution_verified": True,
                "suitability_index": round(sample * scale, 3),
                "region_suitability_evaluated": True,
                "used_in_crop_decision": False,
                "spatial_representation": "single_GAEZ_grid_cell_at_polygon_interior_not_field_measurement",
                "limitations": [
                    "Índice GAEZ histórico modelado, NO resultado actual de finca.",
                    "Muestreo de una celda gruesa que puede mezclar usos y tipos de suelo.",
                    "No es predicción de cosecha, rendimiento ni recomendación de siembra.",
                ],
            })
    except (rasterio.errors.RasterioError, OSError) as exc:
        raise GAEZError("No fue posible abrir el raster FAO comprobado.") from exc
    return result
