"""Public STAC scene *discovery* for a user-selected coordinate.

Do not equate STAC metadata with an NDVI product, soil measurement, or
agricultural diagnosis. NASA POWER and GPM remain primary climate sources.
Sentinel-2 imagery is from ESA/Copernicus and hosted by Microsoft.
"""
from datetime import date, datetime, timedelta, timezone
from math import cos, radians
from typing import Any

import httpx

STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1/search"
CATALOG_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"
COLLECTION = "sentinel-2-l2a"


class SceneCatalogError(Exception):
    """Catalog search failed or returned unusable data."""


def bounded_bbox(latitude: float, longitude: float, radius_km: float = 2.0) -> list[float]:
    """A small WGS84 query box, NOT a cadastral or surveyed farm boundary."""
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        raise ValueError("Invalid coordinates")
    if not (0.5 <= radius_km <= 10):
        raise ValueError("Query radius must be 0.5–10 km")
    lat_offset = radius_km / 111.32
    lon_offset = min(10.0, radius_km / (111.32 * max(0.05, abs(cos(radians(latitude))))))
    return [round(max(-180, longitude - lon_offset), 6),
            round(max(-90, latitude - lat_offset), 6),
            round(min(180, longitude + lon_offset), 6),
            round(min(90, latitude + lat_offset), 6)]


def summarize_scenes(payload: dict[str, Any], cloud_limit: float, count: int) -> dict[str, Any]:
    features = payload.get("features")
    if not isinstance(features, list):
        raise SceneCatalogError("The STAC service returned an invalid collection")
    observations = []
    for feature in features:
        if not isinstance(feature, dict):
            continue
        props = feature.get("properties") or {}
        if not isinstance(props, dict):
            continue
        cloud = props.get("eo:cloud_cover")
        if not isinstance(cloud, (int, float)) or not (0 <= cloud <= cloud_limit):
            continue
        day = props.get("datetime") or props.get("start_datetime")
        if not isinstance(day, str):
            continue
        observations.append({
            "date": day[:10],
            "cloud_cover_percent": round(float(cloud), 1),
            "satellite": str(props.get("platform") or "Sentinel-2"),
            "collection": COLLECTION,
            "scene_id": str(feature.get("id") or ""),
        })
    observations.sort(key=lambda o: (o["date"], -o["cloud_cover_percent"]), reverse=True)
    return {
        "source": "ESA Sentinel-2 L2A via Microsoft Planetary Computer",
        "source_url": CATALOG_URL,
        "status": "available" if observations else "no_matching_scenes",
        "scenes": observations[:count],
        "returned_matching_scenes": len(observations),
        "cloud_cover_limit_percent": cloud_limit,
        "spatial_representation": "Satellite tiles intersecting a small area around the user-selected point; not a parcel boundary",
        "limitations": [
            "Scene availability is not an NDVI calculation or a field health measurement.",
            "Cloud percentage describes the entire scene; clouds over the selected field may differ.",
            "Sentinel-2 is an ESA/Copernicus mission; the data catalog is hosted by Microsoft.",
            "Search results are a limited catalog sample; no result does not mean no imagery exists.",
        ],
        "used_in_crop_decision": False,
    }


async def search_scenes(latitude: float, longitude: float, *, days: int = 120,
                        cloud_limit: float = 35.0, count: int = 5,
                        client: httpx.AsyncClient | None = None,
                        today: date | None = None) -> dict[str, Any]:
    """Discover (not download or process) satellite scenes without credentials."""
    if not (30 <= days <= 365 and 0 <= cloud_limit <= 100 and 1 <= count <= 10):
        raise ValueError("Invalid search settings")
    end = today or datetime.now(timezone.utc).date()
    start = end - timedelta(days=days)
    payload = {
        "collections": [COLLECTION],
        "bbox": bounded_bbox(latitude, longitude),
        "datetime": f"{start.isoformat()}T00:00:00Z/{end.isoformat()}T23:59:59Z",
        "limit": 80,
    }
    owned_client = client is None
    if owned_client:
        client = httpx.AsyncClient(timeout=httpx.Timeout(18.0), follow_redirects=False)
    try:
        response = await client.post(STAC_URL, json=payload,
                                     headers={"Accept": "application/geo+json, application/json"})
        response.raise_for_status()
        result = summarize_scenes(response.json(), cloud_limit, count)
        result["period"] = {"start": start.isoformat(), "end": end.isoformat()}
        result["query_point"] = {"latitude": latitude, "longitude": longitude}
        result["bbox"] = payload["bbox"]
        return result
    except (httpx.HTTPError, ValueError, TypeError) as exc:
        raise SceneCatalogError("Satellite scene catalog unavailable; retry later.") from exc
    finally:
        if owned_client:
            await client.aclose()
