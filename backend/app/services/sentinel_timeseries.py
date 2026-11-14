"""Quality-controlled, bounded time-separated Sentinel-2 NDVI observations.

Per-scene spectral observations ONLY. No compositing, interpolation, forecasts,
crop-growth trends, confidence intervals or parcel-health classification.
"""
from __future__ import annotations

import asyncio
from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
import json
import time
from typing import Any

import httpx
from shapely.geometry import Polygon

from app.connectors.planetary_computer import COLLECTION, STAC_URL, CATALOG_URL
from app.services.sentinel_ndvi import (
    NDVIError, _REMOTE_READS, process_scene, validate_parcel,
)

MAX_ATTEMPTS = 8
MAX_OBSERVATIONS = 4
MIN_DAYS_BETWEEN = 12
CACHE_TTL_SECONDS = 3600
_SERIES_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_SERIES_LOCK = asyncio.Lock()


def _utc_date(value: object) -> date | None:
    """Parse trustworthy timestamps, rejecting invalid and naive STAC dates."""
    if not isinstance(value, str) or not value.endswith("Z"):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return None
    return parsed.date()


def select_spaced_scenes(features: list, start: date, end: date,
                         cloud_limit: float, *, max_attempts: int = MAX_ATTEMPTS,
                         min_gap_days: int = MIN_DAYS_BETWEEN) -> list[dict]:
    """Select spatial STAC candidates by recency, preferring distinct dates.

    Catalog cloud cover is scene-wide and used only as a cheap prefilter;
    subsequent actual SCL pixels determine whether a point is published.
    """
    if not 1 <= max_attempts <= MAX_ATTEMPTS or min_gap_days < 1:
        raise ValueError("Parámetros de selección fuera de límites.")
    eligible: list[tuple[date, float, dict]] = []
    for item in features:
        if not isinstance(item, dict):
            continue
        props = item.get("properties")
        if not isinstance(props, dict):
            continue
        dt = _utc_date(props.get("datetime"))
        cloud = props.get("eo:cloud_cover")
        if (dt is None or dt < start or dt > end or
            isinstance(cloud, bool) or not isinstance(cloud, (int, float)) or
            not 0 <= cloud <= cloud_limit or
            not isinstance(item.get("id"), str) or not item["id"]):
            continue
        eligible.append((dt, float(cloud), item))
    # Stable, deterministic order: most recent dates first, then cloud, ID.
    eligible.sort(key=lambda x: (-x[0].toordinal(), x[1], x[2]["id"]))
    selected: list[tuple[date, dict]] = []
    for dt, _, item in eligible:
        if any(abs((dt - day).days) < min_gap_days for day, _ in selected):
            continue
        selected.append((dt, item))
        if len(selected) >= max_attempts:
            break
    return [item for _, item in selected]


def summarize_series(records: list[dict], attempted: int, area_m2: float,
                     start: date, end: date, cloud_limit: float,
                     catalog_count: int) -> dict:
    """Keep failed/low-quality dates visible without inventing NDVI values."""
    valid = [r for r in records if r.get("status") == "available" and
             isinstance((r.get("metrics") or {}).get("ndvi"), dict)]
    # Chronological view with actual observation gaps. Never interpolate.
    chronological = sorted(records, key=lambda r: (r["date"], r["scene_id"]))
    status = ("available" if len(valid) >= 2 else
              "single_valid_observation" if len(valid) == 1 else
              "no_usable_observations" if attempted else "no_matching_scenes")
    return {
        "status": status,
        "source": "ESA/Copernicus Sentinel-2 L2A via Microsoft Planetary Computer",
        "source_url": CATALOG_URL,
        "product": "Sentinel-2 L2A B04/B08 NDVI with SCL quality mask",
        "period": {"start": start.isoformat(), "end": end.isoformat()},
        "parcel_area_ha_approx": round(area_m2 / 10000, 3),
        "spatial_resolution_m": {"B04": 10, "B08": 10, "SCL_native": 20,
                                 "analysis_grid": 10},
        "min_clear_pixels": 20,
        "min_valid_coverage_percent": 60,
        "min_days_between_selected_scenes": MIN_DAYS_BETWEEN,
        "global_cloud_limit_percent": cloud_limit,
        "catalog_sample_size": catalog_count,
        "attempted_scenes": attempted,
        "valid_observation_count": len(valid),
        "observations": chronological,
        "used_in_crop_decision": False,
        "can_infer_vegetation_trend": False,
        "can_predict_crop_health": False,
        "limitations": [
            "Serie de pocas escenas seleccionadas por recencia y calidad, no censo exhaustivo ni frecuencia fija.",
            "Los promedios usan distintos conjuntos de píxeles claros en cada fecha; NO equivalen a cambios de los mismos píxeles.",
            "Los cambios entre fechas pueden responder a fenología, cosecha, atmósfera, geometría, nubes residuales y suelo.",
            "No se interpolan datos ausentes ni se estima tendencia, rendimiento, riego, estrés o pronóstico.",
            "Los percentiles p10/p90 son dispersión espacial, NO intervalos de confianza instrumentales.",
            "El contorno es declarado y SCL nativa 20 m puede fallar, incluso tras remuestreo a 10 m.",
            "Se requiere contraste en campo e inspección de imágenes antes de cualquier conclusión agronómica.",
        ],
    }


async def calculate_parcel_ndvi_series(
    raw_polygon: dict,
    *,
    days: int = 180,
    cloud_limit: float = 60.0,
    max_observations: int = MAX_OBSERVATIONS,
    client: httpx.AsyncClient | None = None,
    today: date | None = None,
) -> dict:
    """Fetch STAC metadata and read at most eight 10m raster windows.

    All URLs are obtained only from the official STAC endpoint and checked
    against an allowlisted host inside process_scene().
    """
    parcel: Polygon
    parcel, area_m2 = validate_parcel(raw_polygon)
    if not (60 <= days <= 365 and 0 <= cloud_limit <= 100 and
            2 <= max_observations <= MAX_OBSERVATIONS):
        raise ValueError("Periodo, nubosidad o cantidad de observaciones inválidos.")
    end = today or datetime.now(timezone.utc).date()
    start = end - timedelta(days=days)
    cache_key = json.dumps({
        "coordinates": raw_polygon["coordinates"],
        "days": days, "cloud_limit": cloud_limit,
        "max_observations": max_observations, "end": end.isoformat(),
    }, sort_keys=True, separators=(",", ":"))
    async with _SERIES_LOCK:
        entry = _SERIES_CACHE.get(cache_key)
        if entry and time.monotonic() - entry[0] < CACHE_TTL_SECONDS:
            return deepcopy(entry[1])

    owned = client is None
    if owned:
        client = httpx.AsyncClient(timeout=httpx.Timeout(20.0), follow_redirects=False)
    try:
        response = await client.post(STAC_URL, json={
            "collections": [COLLECTION],
            "bbox": list(parcel.bounds),
            "datetime": f"{start.isoformat()}T00:00:00Z/{end.isoformat()}T23:59:59Z",
            "limit": 120,
        }, headers={"Accept": "application/geo+json, application/json"})
        response.raise_for_status()
        data = response.json()
        if not isinstance(data, dict) or not isinstance(data.get("features"), list):
            raise NDVIError("El catálogo satelital devolvió una respuesta incorrecta.")
        features = data["features"]
    except (httpx.HTTPError, ValueError, TypeError) as exc:
        raise NDVIError("El catálogo Sentinel-2 no está disponible.") from exc
    finally:
        if owned:
            await client.aclose()

    candidates = select_spaced_scenes(features, start, end, cloud_limit)
    observations: list[dict] = []
    valid_count = 0
    async with _REMOTE_READS:
        for item in candidates:
            props = item["properties"]
            scene_date = _utc_date(props["datetime"])
            record: dict[str, Any] = {
                "date": scene_date.isoformat(),
                "scene_id": item["id"],
                "satellite": str(props.get("platform") or "Sentinel-2"),
                "scene_cloud_percent": round(float(props["eo:cloud_cover"]), 1),
                "processing_baseline": props.get("s2:processing_baseline"),
                "status": "processing_unavailable",
                "metrics": None,
            }
            try:
                metrics = await asyncio.to_thread(process_scene, item, parcel, area_m2)
                record["metrics"] = metrics
                record["status"] = metrics["status"]
            except (NDVIError, ValueError):
                pass
            observations.append(record)
            if record["status"] == "available" and isinstance((record["metrics"] or {}).get("ndvi"), dict):
                valid_count += 1
            if valid_count >= max_observations:
                break
    result = summarize_series(observations, len(observations), area_m2, start, end,
                              cloud_limit, len(features))
    async with _SERIES_LOCK:
        if len(_SERIES_CACHE) >= 32:
            _SERIES_CACHE.pop(next(iter(_SERIES_CACHE)))
        _SERIES_CACHE[cache_key] = (time.monotonic(), deepcopy(result))
    return result
