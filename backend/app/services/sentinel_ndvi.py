"""Real, bounded Sentinel-2 Level-2A parcel NDVI (ESA via Planetary Computer).

Single-scene, per-parcel surface reflectance. NOT a crop-health assessment.
No anonymous request can supply an asset URL. No signed URL is returned.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from math import ceil, floor, isfinite
from typing import Any
from urllib.parse import urlparse

import httpx
import numpy as np
import planetary_computer
import rasterio
from pyproj import Geod
from rasterio.enums import Resampling
from rasterio.features import geometry_mask
from rasterio.vrt import WarpedVRT
from rasterio.warp import transform_geom
from rasterio.windows import Window, transform as window_transform
from shapely.geometry import Polygon, mapping, shape

from app.connectors.planetary_computer import COLLECTION, STAC_URL, CATALOG_URL

# The conservative mask includes SCL vegetation (4) and non-vegetated land (5).
# Excludes no-data, defects, shadows, water, unclassified, clouds, cirrus, snow.
VALID_SCL = (4, 5)
MAX_VERTICES = 100
MAX_AREA_M2 = 5_000_000  # 500 hectares; public-service resource bound
MIN_AREA_M2 = 1_000     # below 0.1 ha the 10m grid is too coarse to summarize
MAX_WINDOW_PIXELS = 160_000
MIN_CLEAR_PIXELS = 20
MIN_CLEAR_FRACTION = 0.6
MAX_CANDIDATE_SCENES = 3
GEOD = Geod(ellps="WGS84")
_REMOTE_READS = asyncio.Semaphore(2)
_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_CACHE_LOCK = asyncio.Lock()
CACHE_TTL_SECONDS = 3600


class NDVIError(Exception):
    """Service or image access failure, never an agronomic inference."""


def validate_parcel(raw: dict) -> tuple[Polygon, float]:
    """Require a bounded WGS84 GeoJSON polygon with one exterior ring."""
    if not isinstance(raw, dict) or raw.get("type") != "Polygon":
        raise ValueError("Se requiere un polígono GeoJSON WGS84.")
    rings = raw.get("coordinates")
    if not isinstance(rings, list) or len(rings) != 1 or not isinstance(rings[0], list):
        raise ValueError("Solo se admite un contorno exterior sin huecos.")
    ring = rings[0]
    if not 4 <= len(ring) <= MAX_VERTICES + 1:
        raise ValueError("El polígono requiere de 3 a 100 vértices.")
    if ring[0] != ring[-1]:
        raise ValueError("El contorno debe estar cerrado.")
    clean = []
    for coordinate in ring:
        if not isinstance(coordinate, list) or len(coordinate) != 2:
            raise ValueError("Las coordenadas deben ser [longitud, latitud].")
        lng, lat = coordinate
        if (isinstance(lng, bool) or isinstance(lat, bool) or
                not isinstance(lng, (int, float)) or not isinstance(lat, (int, float)) or
                not isfinite(lng) or not isfinite(lat) or
                not (-180 < lng < 180) or not (-80 <= lat <= 80)):
            raise ValueError("Coordenadas geográficas inválidas.")
        clean.append((float(lng), float(lat)))
    polygon = Polygon(clean)
    if not polygon.is_valid or polygon.is_empty or polygon.area <= 0:
        raise ValueError("El polígono está vacío o se cruza consigo mismo.")
    minx, _, maxx, _ = polygon.bounds
    if maxx - minx >= 1:
        raise ValueError("Los polígonos que cruzan el antimeridiano no se admiten.")
    area_m2, _ = GEOD.geometry_area_perimeter(polygon)
    area_m2 = abs(area_m2)
    if not MIN_AREA_M2 <= area_m2 <= MAX_AREA_M2:
        raise ValueError("Área admitida: de 0,1 a 500 hectáreas.")
    return polygon, area_m2


def parse_baseline(value: Any) -> float:
    """Refuse unknown radiometry; do not assume offsets from capture dates."""
    if not isinstance(value, str):
        raise ValueError("Falta la versión radiométrica de la escena.")
    try:
        baseline = float(value)
    except ValueError as exc:
        raise ValueError("Versión radiométrica no reconocida.") from exc
    if not isfinite(baseline) or not 1 <= baseline < 20:
        raise ValueError("Versión radiométrica no reconocida.")
    return baseline


def analyze_pixels(red: np.ndarray, nir: np.ndarray, scl: np.ndarray,
                   inside: np.ndarray, baseline: float, area_m2: float,
                   pixel_area_m2: float) -> dict[str, Any]:
    """Pure numerical core; source DN=0 is always nodata, even with BOA offset."""
    if red.shape != nir.shape or red.shape != scl.shape or inside.shape != red.shape:
        raise ValueError("Las bandas no comparten una cuadrícula.")
    if red.ndim != 2 or red.size > MAX_WINDOW_PIXELS:
        raise ValueError("Ventana de imagen demasiado grande.")
    offset = 1000 if baseline >= 4 else 0
    total = int(np.count_nonzero(inside))
    if total == 0:
        return {"status": "no_spatial_coverage", "parcel_pixels": 0, "valid_pixels": 0,
                "valid_fraction_percent": 0.0, "scene_coverage_percent_approx": 0.0,
                "ndvi": None, "scl_classes_within_parcel": {}}
    r = red.astype(np.float32)
    n = nir.astype(np.float32)
    good_dn = (r > 0) & (n > 0)
    reflectance_red = (r - offset) / 10000
    reflectance_nir = (n - offset) / 10000
    denom = reflectance_red + reflectance_nir
    with np.errstate(divide="ignore", invalid="ignore"):
        ndvi = (reflectance_nir - reflectance_red) / denom
    good = (inside & np.isin(scl, VALID_SCL) & good_dn &
            (denom > 0) & np.isfinite(ndvi) &
            (ndvi >= -1) & (ndvi <= 1))
    valid_count = int(np.count_nonzero(good))
    # Percentage uses full user polygon area, including parts outside this tile.
    fraction = min(1.0, valid_count * pixel_area_m2 / area_m2)
    coverage = min(1.0, total * pixel_area_m2 / area_m2)
    classes, counts = np.unique(scl[inside], return_counts=True)
    histogram = {str(int(k)): int(v) for k, v in zip(classes, counts)}
    enough = valid_count >= MIN_CLEAR_PIXELS and fraction >= MIN_CLEAR_FRACTION
    statistics = None
    if enough:
        v = ndvi[good].astype(np.float64)
        statistics = {
            "mean": round(float(np.mean(v)), 4),
            "median": round(float(np.median(v)), 4),
            "p10": round(float(np.percentile(v, 10)), 4),
            "p90": round(float(np.percentile(v, 90)), 4),
            "spatial_std": round(float(np.std(v)), 4),
            "min": round(float(np.min(v)), 4),
            "max": round(float(np.max(v)), 4),
        }
    return {
        "status": "available" if enough else "insufficient_clear_pixels",
        "parcel_pixels": total,
        "valid_pixels": valid_count,
        "valid_fraction_percent": round(fraction * 100, 1),
        "scene_coverage_percent_approx": round(coverage * 100, 1),
        "scl_classes_within_parcel": histogram,
        "ndvi": statistics,
    }


def _safe_signed_asset(item: dict, key: str) -> str:
    """Allow only the expected Azure COG host, never caller-provided URLs."""
    asset = (item.get("assets") or {}).get(key) or {}
    href = asset.get("href")
    if not isinstance(href, str):
        raise NDVIError("La escena no contiene las bandas B04, B08 y SCL.")
    parsed = urlparse(href)
    if parsed.scheme != "https" or parsed.hostname != "sentinel2l2a01.blob.core.windows.net":
        raise NDVIError("La ubicación del raster no es una fuente aprobada.")
    try:
        signed = planetary_computer.sign(href)
    except Exception as exc:
        raise NDVIError("El proveedor no pudo autorizar la lectura del raster.") from exc
    # Defend against a malformed or provider-redirected URL being passed to GDAL.
    signed_host = urlparse(signed).hostname if isinstance(signed, str) else None
    if signed_host != parsed.hostname:
        raise NDVIError("El raster firmado cambió de proveedor.")
    return signed


def process_scene(item: dict, parcel: Polygon, area_m2: float) -> dict[str, Any]:
    """Read only a small projected window, align 20m SCL with 10m red/NIR."""
    baseline = parse_baseline((item.get("properties") or {}).get("s2:processing_baseline"))
    red_url, nir_url, scl_url = (_safe_signed_asset(item, k) for k in ("B04", "B08", "SCL"))
    try:
        with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
                          GDAL_HTTP_TIMEOUT="12", GDAL_HTTP_MAX_RETRY="1",
                          GDAL_HTTP_RETRY_DELAY="1"):
            with rasterio.open(red_url) as red_ds, rasterio.open(nir_url) as nir_ds, rasterio.open(scl_url) as scl_ds:
                if red_ds.crs is None or red_ds.res[0] <= 0 or red_ds.res[1] <= 0:
                    raise NDVIError("La escena carece de georreferenciación válida.")
                if max(abs(red_ds.res[0]), abs(red_ds.res[1])) > 12:
                    raise NDVIError("La banda roja no tiene resolución nominal de 10 m.")
                projected = transform_geom("EPSG:4326", red_ds.crs, mapping(parcel))
                geom = shape(projected)
                xmin, ymin, xmax, ymax = geom.bounds
                window_f = red_ds.window(xmin, ymin, xmax, ymax)
                col0, row0 = floor(window_f.col_off), floor(window_f.row_off)
                col1, row1 = ceil(window_f.col_off + window_f.width), ceil(window_f.row_off + window_f.height)
                col0, row0 = max(0, col0), max(0, row0)
                col1, row1 = min(red_ds.width, col1), min(red_ds.height, row1)
                if col1 <= col0 or row1 <= row0:
                    return analyze_pixels(np.zeros((1, 1)), np.zeros((1, 1)),
                                          np.zeros((1, 1)), np.zeros((1, 1), bool),
                                          baseline, area_m2, abs(red_ds.res[0] * red_ds.res[1]))
                window = Window(col0, row0, col1 - col0, row1 - row0)
                if window.width * window.height > MAX_WINDOW_PIXELS:
                    raise NDVIError("La parcela excede el límite de procesamiento satelital.")
                mask = geometry_mask([projected],
                                     out_shape=(int(window.height), int(window.width)),
                                     transform=window_transform(window, red_ds.transform),
                                     invert=True, all_touched=False)
                red = red_ds.read(1, window=window)
                # Explicit WarpedVRT ensures B08 and 20m SCL share the red 10m grid.
                vrt_options = dict(crs=red_ds.crs, transform=red_ds.transform,
                                   width=red_ds.width, height=red_ds.height,
                                   src_nodata=0, nodata=0)
                with WarpedVRT(nir_ds, resampling=Resampling.bilinear, **vrt_options) as nir_vrt:
                    nir = nir_vrt.read(1, window=window)
                with WarpedVRT(scl_ds, resampling=Resampling.nearest, **vrt_options) as scl_vrt:
                    scl = scl_vrt.read(1, window=window)
                pixel_area = abs(red_ds.transform.a * red_ds.transform.e -
                                 red_ds.transform.b * red_ds.transform.d)
                return analyze_pixels(red, nir, scl, mask, baseline, area_m2, pixel_area)
    except (rasterio.errors.RasterioError, OSError) as exc:
        raise NDVIError("No fue posible leer los rasters remotos; intenta nuevamente.") from exc


async def calculate_parcel_ndvi(raw_polygon: dict, days: int = 120,
                                cloud_limit: float = 65.0,
                                client: httpx.AsyncClient | None = None,
                                today=None) -> dict[str, Any]:
    parcel, area_m2 = validate_parcel(raw_polygon)
    if not (30 <= days <= 365 and 0 <= cloud_limit <= 100):
        raise ValueError("Periodo o límite de nubes no admitido.")
    # Anonymous users cannot select filenames, signed URLs or arbitrary scenes.
    import json
    import time
    key = json.dumps({"coordinates": raw_polygon["coordinates"], "days": days,
                      "cloud_limit": cloud_limit}, sort_keys=True, separators=(",", ":"))
    now = time.monotonic()
    async with _CACHE_LOCK:
        cached = _CACHE.get(key)
        if cached and now - cached[0] < CACHE_TTL_SECONDS:
            return dict(cached[1])

    end = today or datetime.now(timezone.utc).date()
    start = end - timedelta(days=days)
    owned_client = client is None
    if owned_client:
        client = httpx.AsyncClient(timeout=httpx.Timeout(20), follow_redirects=False)
    try:
        response = await client.post(STAC_URL, json={
            "collections": [COLLECTION],
            "bbox": list(parcel.bounds),
            "datetime": f"{start.isoformat()}T00:00:00Z/{end.isoformat()}T23:59:59Z",
            "limit": 70,
        }, headers={"Accept": "application/geo+json, application/json"})
        response.raise_for_status()
        features = response.json().get("features")
        if not isinstance(features, list):
            raise NDVIError("El catálogo satelital no devolvió escenas válidas.")
    except (httpx.HTTPError, ValueError, TypeError) as exc:
        raise NDVIError("No fue posible consultar las escenas Sentinel-2.") from exc
    finally:
        if owned_client:
            await client.aclose()

    eligible = []
    for item in features:
        if not isinstance(item, dict) or not isinstance(item.get("properties"), dict):
            continue
        props = item["properties"]
        cloud = props.get("eo:cloud_cover")
        date_text = props.get("datetime")
        if isinstance(cloud, (int, float)) and not isinstance(cloud, bool) and 0 <= cloud <= cloud_limit and isinstance(date_text, str):
            eligible.append(item)
    eligible.sort(key=lambda f: f["properties"]["datetime"], reverse=True)
    candidates = eligible[:MAX_CANDIDATE_SCENES]
    result = {
        "source": "ESA/Copernicus Sentinel-2 L2A via Microsoft Planetary Computer",
        "source_url": CATALOG_URL,
        "period": {"start": start.isoformat(), "end": end.isoformat()},
        "parcel_area_ha_approx": round(area_m2 / 10000, 3),
        "product": "Sentinel-2 L2A BOA B04 / B08 with SCL",
        "spatial_resolution_m": {"B04": 10, "B08": 10, "SCL_native": 20, "analysis_grid": 10},
        "scl_allowed": [4, 5],
        "method": "NDVI = (NIR - Red)/(NIR + Red). Per-scene BOA baseline offset corrected; 20m SCL nearest-neighbour to 10m grid.",
        "status": "no_matching_scenes",
        "scene": None,
        "metrics": None,
        "attempted_scenes": 0,
        "used_in_crop_decision": False,
        "interpretation": "Índice de reflectancia de superficie, no diagnóstico de salud, plagas, rendimiento ni aptitud agrícola.",
        "uncertainty": [
            "Percentiles p10/p90 describe la dispersión espacial entre píxeles, NO un intervalo de confianza ni incertidumbre instrumental.",
            "SCL puede omitir nubes finas o sombras; remuestrear SCL de 20 a 10 m no mejora su resolución real.",
            "Bordes de parcela aproximados; píxeles mixtos, geolocalización y variaciones atmosféricas pueden afectar el índice.",
            "El porcentaje válido es aproximado (centros de píxel × área nominal) y no sustituye una validación de campo.",
            "Se analiza una sola escena; no se infieren cambios temporales ni condiciones de cultivo.",
        ],
    }
    errors = 0
    best_insufficient = None
    async with _REMOTE_READS:
        for item in candidates:
            result["attempted_scenes"] += 1
            try:
                metrics = await asyncio.to_thread(process_scene, item, parcel, area_m2)
            except (NDVIError, ValueError):
                errors += 1
                continue
            record = {
                "id": str(item.get("id", "")),
                "date": item["properties"]["datetime"][:10],
                "cloud_cover_percent_scene": float(item["properties"]["eo:cloud_cover"]),
                "processing_baseline": item["properties"].get("s2:processing_baseline"),
                "platform": item["properties"].get("platform", "Sentinel-2"),
            }
            if metrics["status"] == "available":
                result.update(status="available", scene=record, metrics=metrics)
                break
            if best_insufficient is None or metrics["valid_pixels"] > best_insufficient[1]["valid_pixels"]:
                best_insufficient = (record, metrics)
        else:
            if best_insufficient is not None:
                result.update(status=best_insufficient[1]["status"],
                              scene=best_insufficient[0], metrics=best_insufficient[1])
            elif candidates and errors == len(candidates):
                result["status"] = "processing_unavailable"
    if result["status"] in ("available", "insufficient_clear_pixels", "no_spatial_coverage"):
        async with _CACHE_LOCK:
            if len(_CACHE) >= 32:
                _CACHE.pop(next(iter(_CACHE)))
            _CACHE[key] = (time.monotonic(), dict(result))
    return result
