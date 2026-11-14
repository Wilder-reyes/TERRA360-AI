# AI-assisted: written with Claude Code (Anthropic) and reviewed by the TERRA360 team.
"""Field Shift rotation comparator API.

GET  /api/rotation/zones       demo zones (Huaral, Barranca) from MIDAGRI 2024
GET  /api/rotation/crops       team crop catalogue (13 crops) + coastal seasons
GET  /api/rotation/templates   team S0/S1/S2 test rotations (backup for the demo)
GET  /api/rotation/climate     NASA POWER monthly ET0 / Tmax for a zone or point
GET  /api/rotation/upper-basin-rain  GPM IMERG monthly rain in the upper basin («agua que viene»)
POST /api/rotation/history     monthly NDVI 2021-today for a GeoJSON field (HLS, fallback S2)
POST /api/rotation/compare     S0 (current) vs S1 «Water» vs S2 «Soil», 5-section explanations
"""
from __future__ import annotations

import asyncio
import json
import os
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.services import rotation_engine as engine
from app.services.hls_history import cached_history, monthly_history
from app.services.imerg_basin import basin_context
from app.services.power_climatology import ClimateError, monthly_climate
from app.services.rotation_zones import get_zone, list_zones
from app.services.sentinel_ndvi import NDVIError

router = APIRouter(prefix="/api/rotation", tags=["rotation"])


def polygon_from_geojson(value: Any) -> dict:
    """Accept a GeoJSON Polygon, Feature or FeatureCollection (first polygon)."""
    if isinstance(value, dict) and value.get("type") == "FeatureCollection":
        feats = value.get("features") or []
        value = next((f for f in feats if isinstance(f, dict) and (f.get("geometry") or {}).get("type") == "Polygon"), None)
    if isinstance(value, dict) and value.get("type") == "Feature":
        value = value.get("geometry")
    if isinstance(value, dict) and value.get("type") == "MultiPolygon":
        coords = value.get("coordinates") or []
        if len(coords) == 1:
            value = {"type": "Polygon", "coordinates": coords[0]}
    if not isinstance(value, dict) or value.get("type") != "Polygon":
        raise HTTPException(422, "Se requiere un polígono GeoJSON (Polygon, Feature o FeatureCollection).")
    rings = value.get("coordinates")
    if isinstance(rings, list) and rings and isinstance(rings[0], list):
        # Invalid coordinates are user input errors, never unexpected 500 responses.
        # Reject non-finite values before they reach rasterio or Shapely.
        import math
        try:
            ring = [[float(x) for x in pt[:2]] for pt in rings[0]
                    if isinstance(pt, list) and len(pt) >= 2]
        except (TypeError, ValueError, OverflowError) as exc:
            raise HTTPException(422, "El polígono contiene coordenadas no numéricas.") from exc
        if not ring or not all(math.isfinite(x) for pt in ring for x in pt):
            raise HTTPException(422, "El polígono contiene coordenadas inválidas.")
        if len(ring) >= 3 and ring[0] != ring[-1]:
            ring.append(ring[0])
        return {"type": "Polygon", "coordinates": [ring]}
    raise HTTPException(422, "El polígono no tiene coordenadas válidas.")


class HistoryRequest(BaseModel):
    polygon: dict[str, Any]
    start_year: int = Field(2021, ge=2020, le=2030)
    prefer: Literal["hls", "sentinel2"] = "hls"


class Planting(BaseModel):
    crop_id: str
    start_index: int = Field(ge=0, le=23, description="0 = August of year 1")
    days: int | None = Field(None, ge=30, le=730)


class Priorities(BaseModel):
    water: int = Field(1, ge=0, le=2)
    soil: int = Field(1, ge=0, le=2)
    income: int = Field(1, ge=0, le=2)
    pests: int = Field(1, ge=0, le=2)


class CompareRequest(BaseModel):
    zone: Literal["huaral", "barranca"] | None = None
    latitude: float | None = Field(None, ge=-60, le=60)
    longitude: float | None = Field(None, ge=-180, le=180)
    current: list[Planting] = Field(default_factory=list, max_length=10)
    priorities: Priorities = Priorities()
    water_turn: Literal["normal", "escaso", "no_se"] = "normal"
    history: dict[str, Any] | None = Field(None, description="summary: sensor, start, end, months_with_data")
    current_source: Literal["farmer_declared", "satellite_confirmed", "team_demo"] = "farmer_declared"
    income_crop_id: str | None = None
    use_team_templates_as_fallback: bool = False


@router.get("/zones")
def zones():
    return {"zones": list_zones()}


@router.get("/crops")
def crops():
    return engine.load_catalog()["raw"]


@router.get("/templates")
def templates():
    return {"source": "../analisis-challenge/07-rotaciones-demo-y-terrenos.md (team test cases)",
            "convention": "start_index 0 = August of year 1", "templates": engine.TEMPLATES}


async def _climate(zone: str | None, lat: float | None, lon: float | None) -> dict:
    if zone:
        z = get_zone(zone)
        lat, lon = z["lat"], z["lng"]
    if lat is None or lon is None:
        raise HTTPException(422, "Indica zone o latitude/longitude.")
    try:
        return await monthly_climate(lat, lon)
    except ClimateError as exc:
        raise HTTPException(503, f"{exc} Sin clima no se comparan rotaciones (abstención).") from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@router.get("/upper-basin-rain")
def upper_basin_rain(zone: Literal["huaral", "barranca"]):
    return basin_context(zone)


@router.get("/climate")
async def climate(zone: Literal["huaral", "barranca"] | None = None,
                  latitude: float | None = Query(None, ge=-60, le=60),
                  longitude: float | None = Query(None, ge=-180, le=180)):
    return await _climate(zone, latitude, longitude)


# The first history of a new field reads ~100-200 small raster windows (40-80 s).
# Hosting proxies cut long requests (~26 s on Netlify), so the computation runs
# as a background job: the endpoint waits up to WAIT_SECONDS and otherwise
# answers 202 {"status": "processing"}; the client repeats the same POST.
# On Vercel Functions work stops after the response, so wait in-request (limit 300 s).
WAIT_SECONDS = float(os.getenv("TERRA360_HISTORY_WAIT") or (280 if os.getenv("VERCEL") else 20))
MAX_JOBS = 8
_JOBS: dict[str, asyncio.Task] = {}


@router.post("/history")
async def history(req: HistoryRequest):
    polygon = polygon_from_geojson(req.polygon)
    try:
        from app.services.sentinel_ndvi import validate_parcel
        validate_parcel(polygon)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    done = cached_history(polygon, req.start_year, req.prefer)
    if done is not None:
        return done
    key = json.dumps([polygon["coordinates"], req.start_year, req.prefer], separators=(",", ":"))
    task = _JOBS.get(key)
    if task is None:
        if sum(not t.done() for t in _JOBS.values()) >= MAX_JOBS:
            raise HTTPException(429, "Hay demasiados historiales en cálculo; intenta en un minuto.")
        task = asyncio.create_task(monthly_history(polygon, start_year=req.start_year, prefer=req.prefer))
        _JOBS[key] = task
    try:
        result = await asyncio.wait_for(asyncio.shield(task), timeout=WAIT_SECONDS)
    except asyncio.TimeoutError:
        return JSONResponse(status_code=202, content={
            "status": "processing",
            "message_es": "Seguimos leyendo las fotos del satélite. Vuelve a consultar en unos segundos.",
            "message_en": "Still reading satellite images. Ask again in a few seconds.",
            "retry_after_seconds": 5})
    except ValueError as exc:
        _JOBS.pop(key, None)
        raise HTTPException(422, str(exc)) from exc
    except NDVIError as exc:
        _JOBS.pop(key, None)
        raise HTTPException(503, str(exc)) from exc
    _JOBS.pop(key, None)
    return result


@router.post("/compare")
async def compare(req: CompareRequest):
    if not req.current:
        return {"status": "needs_current_rotation",
                "message_es": "Primero confirma qué sembraste en cada campaña. Sin tu rotación actual no comparamos (no inventamos datos).",
                "message_en": "First confirm what you planted in each campaign. Without your current rotation we do not compare (we do not invent data).",
                "strategies": []}
    clim = await _climate(req.zone, req.latitude, req.longitude)
    try:
        result = engine.compare([p.model_dump() for p in req.current], clim,
                                priorities=req.priorities.model_dump(), water_turn=req.water_turn,
                                history=req.history, current_origin=req.current_source,
                                income_crop_id=req.income_crop_id,
                                fallback=engine.TEMPLATES if req.use_team_templates_as_fallback else None)
    except engine.RotationError as exc:
        raise HTTPException(422, str(exc)) from exc
    result["zone"] = req.zone
    # P1 «agua que viene»: IMERG rain in the upper basin (context only; abstains if not computed).
    if req.zone in ("huaral", "barranca"):
        basin = basin_context(req.zone)
    else:
        basin = {
            "status": "unavailable",
            "message_es": "No contamos con datos de lluvia de la cuenca para este lugar.",
            "message_en": "Upper-basin rainfall has not been calculated for this location.",
            "climatology_mm_month": {},
        }
    result["upper_basin_rain"] = basin
    if basin["status"] == "available":
        for month in result["window"]["context"]:
            month["basin_rain_mm"] = basin["climatology_mm_month"].get(str(month["calendar_month"]),
                                                                       basin["climatology_mm_month"].get(month["calendar_month"]))
    return result
