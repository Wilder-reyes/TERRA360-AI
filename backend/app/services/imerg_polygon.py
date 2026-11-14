"""Area-weighted NASA GPM IMERG Late V07 daily rainfall grid context.

This reads *existing* verified-format NASA NetCDF daily granules and NEVER
downscales coarse 0.1-degree NASA cells into plot-scale rainfall observations.
No anonymous request is allowed to initiate NASA downloads or select paths.
"""
from __future__ import annotations

from datetime import date
from math import isfinite
from pathlib import Path
from typing import Any

import numpy as np
import xarray as xr
from shapely.geometry import box
from app.services.sentinel_ndvi import GEOD, validate_parcel

PRODUCT = "GPM_3IMERGDL"
VERSION = "07"
RUN = "Late"
VAR = "precipitation"
RESOLUTION_DEG = .1
MAX_BBOX_CELLS = 64
MAX_INTERSECTING_CELLS = 16
MIN_VALID_AREA_FRACTION = .8
SOURCE_URL = "https://disc.gsfc.nasa.gov/datasets/GPM_3IMERGDL_07/summary"
DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "gpm"


class IMERGPolygonError(RuntimeError):
    """Invalid raster schema or bounded spatial processing failure."""


def find_local_imerg(target_date: date, directory: Path = DATA_DIR) -> Path | None:
    """No network or disk write; only explicitly staged daily NASA files."""
    pattern = f"3B-DAY-L.MS.MRG.3IMERG.{target_date:%Y%m%d}-S000000-E235959.*.nc4"
    candidates = sorted(directory.glob(pattern))
    return candidates[0] if candidates else None


def _indices(coords: np.ndarray, lower: float, upper: float) -> np.ndarray:
    if coords.ndim != 1 or coords.size < 2 or not np.isfinite(coords).all():
        raise IMERGPolygonError("La cuadrícula NASA carece de coordenadas válidas.")
    differences = np.diff(coords)
    if not (np.all(differences > 0) or np.all(differences < 0)):
        raise IMERGPolygonError("Las coordenadas NASA no son monótonas.")
    # Verify the original 0.1 degree grid, not a resampled grid.
    if not np.all(np.isclose(np.abs(differences), RESOLUTION_DEG, atol=0.00001)):
        raise IMERGPolygonError("La resolución no coincide con IMERG 0,1°.")
    return np.flatnonzero((coords >= lower - RESOLUTION_DEG / 2) &
                          (coords <= upper + RESOLUTION_DEG / 2))


def _grid_data(dataset: xr.Dataset, lon_indices: np.ndarray, lat_indices: np.ndarray,
               variable: str) -> np.ndarray:
    data = dataset[variable]
    if set(data.dims) != {"time", "lat", "lon"} or data.sizes["time"] != 1:
        raise IMERGPolygonError("Dimensiones diarias NASA inesperadas.")
    return np.asarray(data.isel(
        time=0, lon=lon_indices, lat=lat_indices
    ).transpose("lat", "lon").values)


def sample_daily_imerg(dataset: xr.Dataset, raw_polygon: dict,
                       target_date: date, filename: str = "") -> dict[str, Any]:
    """Geodesic intersection area weights; no sub-cell accuracy claims.

    Area weights account for how much of the requested outline intersects each
    *uniform* IMERG grid cell. The underlying rainfall resolution remains 0.1°.
    """
    polygon, area_m2 = validate_parcel(raw_polygon)
    if VAR not in dataset or "lat" not in dataset.coords or "lon" not in dataset.coords:
        raise IMERGPolygonError("El archivo no contiene las bandas GPM esperadas.")
    if "time" not in dataset.dims:
        raise IMERGPolygonError("No se encontró un archivo diario GPM.")
    units = str(dataset[VAR].attrs.get("units", "")).strip().lower().replace(" ", "")
    if units not in ("mm/day", "mmd-1", "mmday-1"):
        raise IMERGPolygonError("Unidades de precipitación no verificadas; se evita calcular.")
    lon = np.asarray(dataset["lon"].values, dtype=float)
    lat = np.asarray(dataset["lat"].values, dtype=float)
    xmin, ymin, xmax, ymax = polygon.bounds
    lon_indices = _indices(lon, xmin, xmax)
    lat_indices = _indices(lat, ymin, ymax)
    if not len(lon_indices) or not len(lat_indices):
        raise IMERGPolygonError("El polígono está fuera de la cuadrícula NASA.")
    if len(lon_indices) * len(lat_indices) > MAX_BBOX_CELLS:
        raise ValueError("La forma del terreno abarca demasiadas celdas IMERG.")
    try:
        precipitation = _grid_data(dataset, lon_indices, lat_indices, VAR)
        counts = (_grid_data(dataset, lon_indices, lat_indices, "precipitation_cnt")
                  if "precipitation_cnt" in dataset else None)
    except (KeyError, ValueError, OSError) as exc:
        raise IMERGPolygonError("No fue posible leer la cuadrícula NASA.") from exc

    cells: list[dict[str, Any]] = []
    valid_area = 0.0
    weighted_sum = 0.0
    for i, lat_index in enumerate(lat_indices):
        for j, lon_index in enumerate(lon_indices):
            north = float(lat[lat_index])
            east = float(lon[lon_index])
            clipped = polygon.intersection(box(
                east - .05, north - .05, east + .05, north + .05
            ))
            if clipped.is_empty:
                continue
            overlap = abs(GEOD.geometry_area_perimeter(clipped)[0])
            if overlap < 0.001:
                continue
            if len(cells) >= MAX_INTERSECTING_CELLS:
                raise ValueError("La forma del terreno intersecta demasiadas celdas.")
            val = float(precipitation[i, j])
            cnt = float(counts[i, j]) if counts is not None else None
            valid = (isfinite(val) and val >= 0 and val < 9999 and
                     (cnt is None or (isfinite(cnt) and cnt > 0)))
            if valid:
                valid_area += overlap
                weighted_sum += overlap * val
            cells.append({
                "center_latitude": round(north, 5),
                "center_longitude": round(east, 5),
                "overlap_area_percent_approx": round(100 * overlap / area_m2, 2),
                "precipitation_mm_day": round(val, 3) if valid else None,
                "valid": valid,
            })
    coverage = min(1.0, max(0.0, valid_area / area_m2))
    ready = bool(cells and valid_area > 0 and coverage >= MIN_VALID_AREA_FRACTION)
    precipitation_avg = round(weighted_sum / valid_area, 3) if ready else None
    return {
        "status": "available" if ready else "insufficient_valid_grid_coverage",
        "source": "NASA GPM IMERG Late Daily V07",
        "source_url": SOURCE_URL,
        "product": PRODUCT,
        "version": VERSION,
        "run": RUN,
        "date": target_date.isoformat(),
        "variable": VAR,
        "unit": "mm/day",
        "native_resolution": "0.1° x 0.1° (~10 km at equator; varies by latitude)",
        "representation": "area_weighted_coarse_grid_estimate_not_parcel_measurement",
        "weighting": "geodesic_overlap_area_of_original_IMERG_cells",
        "area_ha_approx": round(area_m2 / 10000, 3),
        "valid_area_percent_approx": round(coverage * 100, 1),
        "minimum_valid_area_percent": int(MIN_VALID_AREA_FRACTION * 100),
        "grid_cell_count": len(cells),
        "valid_grid_cell_count": sum(1 for cell in cells if cell["valid"]),
        "precipitation_mm_day": precipitation_avg,
        "cells": cells,
        "file": Path(filename).name if filename else None,
        "quality_count_variable_used": counts is not None,
        "used_in_crop_decision": False,
        "can_infer_field_rainfall": False,
        "limitations": [
            "La cuadrícula nativa es de 0,1°; superponer una parcela pequeña NO mejora su resolución física.",
            "Una sola celda equivale a un dato regional, no a una estación de lluvia en la parcela.",
            "Las áreas se ponderan por superposición geodésica; no se interpolan nuevos valores subcelda.",
            "Las celdas faltantes se excluyen; con menos de 80 % de cobertura válida no se publica promedio.",
            "Las estimaciones IMERG pueden tener sesgos en relieve complejo y requieren contraste con pluviómetros.",
            "No se calcula incertidumbre física, riego, rendimiento ni recomendaciones de cultivos.",
        ],
    }


def daily_polygon_from_staged_file(raw_polygon: dict, target_date: date,
                                   directory: Path = DATA_DIR) -> dict:
    """Read local NASA file or explicitly abstain; never download on public POST."""
    polygon, area_m2 = validate_parcel(raw_polygon)
    file_path = find_local_imerg(target_date, directory)
    if file_path is None:
        return {
            "status": "data_unavailable",
            "source": "NASA GPM IMERG Late Daily V07",
            "source_url": SOURCE_URL,
            "product": PRODUCT, "version": VERSION, "run": RUN,
            "date": target_date.isoformat(),
            "unit": "mm/day",
            "native_resolution": "0.1° x 0.1°",
            "area_ha_approx": round(area_m2 / 10000, 3),
            "precipitation_mm_day": None,
            "valid_area_percent_approx": 0,
            "grid_cell_count": 0,
            "cells": [],
            "used_in_crop_decision": False,
            "can_infer_field_rainfall": False,
            "limitations": [
                "No se encontró un archivo diario NASA IMERG autorizado en el servidor.",
                "La API pública no descarga archivos NASA ni inventa una precipitación.",
                "NASA IMERG es estimación regional de cuadrícula 0,1°, no dato de parcela.",
            ],
        }
    try:
        with xr.open_dataset(file_path, engine="h5netcdf") as dataset:
            return sample_daily_imerg(dataset, raw_polygon, target_date,
                                      filename=file_path.name)
    except (OSError, ValueError, RuntimeError) as exc:
        if isinstance(exc, ValueError) and ("forma del terreno" in str(exc)):
            raise
        raise IMERGPolygonError("El archivo NASA disponible no pudo verificarse.") from exc


def daily_polygon_from_archive(raw_polygon: dict, target_date: date) -> dict[str, Any]:
    """Prefer durable private object storage; fallback to legacy local files only.

    Never authenticate with Earthdata or download a protected NASA file in a
    public HTTP request. A missing manifest is not a zero rainfall observation.
    """
    from app.services.verified_archive import ArchiveError, staged_granule
    try:
        with staged_granule("gpm", target_date) as path:
            if path is not None:
                with xr.open_dataset(path, engine="h5netcdf") as dataset:
                    out = sample_daily_imerg(dataset, raw_polygon, target_date,
                                             filename=path.name)
                out["provenance"] = "sha256_verified_private_object_archive"
                return out
    except ArchiveError as exc:
        raise IMERGPolygonError("El archivo NASA privado no pasó verificaciones de acceso o integridad.") from exc
    return daily_polygon_from_staged_file(raw_polygon, target_date)
