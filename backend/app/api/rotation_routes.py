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
from app.services import field_shift_ai as field_ai
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


class FieldSoil(BaseModel):
    # Optional, farmer-declared observations, never inferred from GPM / SMAP.
    texture: Literal["arenosa", "franca", "arcillosa"] | None = None
    ph: float | None = Field(None, ge=0, le=14)
    salinity_ds_m: float | None = Field(None, ge=0, le=100)
    organic_matter_percent: float | None = Field(None, ge=0, le=100)
    drainage: Literal["bueno", "regular", "malo"] | None = None
    source: Literal["farmer_reported", "lab_report"] = "farmer_reported"


class CropBudget(BaseModel):
    crop_id: str
    yield_kg_ha: float = Field(ge=0, le=300000)
    price_soles_kg: float = Field(ge=0, le=10000)
    cost_soles_ha: float = Field(ge=0, le=1000000)


class BudgetPlanting(BaseModel):
    crop_id: str


class BudgetStrategy(BaseModel):
    id: Literal["S0", "S1", "S2"]
    plantings: list[BudgetPlanting] = Field(max_length=12)


class EconomicsRequest(BaseModel):
    strategies: list[BudgetStrategy] = Field(min_length=1, max_length=3)
    crop_budgets: list[CropBudget] = Field(min_length=1, max_length=16)


class SpatialZoneRequest(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    crop_id: str
    planted_month: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    polygon: dict[str, Any] | None = None


class SpatialPlanRequest(BaseModel):
    polygon: dict[str, Any]
    zones: list[SpatialZoneRequest] = Field(min_length=1, max_length=25)


class CompareRequest(BaseModel):
    zone: Literal["huaral", "barranca"] | None = None
    polygon: dict[str, Any] | None = None
    latitude: float | None = Field(None, ge=-60, le=60)
    longitude: float | None = Field(None, ge=-180, le=180)
    current: list[Planting] = Field(default_factory=list, max_length=10)
    priorities: Priorities = Priorities()
    water_turn: Literal["normal", "escaso", "no_se"] = "normal"
    history: dict[str, Any] | None = Field(None, description="summary: sensor, start, end, months_with_data")
    current_source: Literal["farmer_declared", "satellite_confirmed", "team_demo"] = "farmer_declared"
    income_crop_id: str | None = None
    soil: FieldSoil | None = None
    crop_budgets: list[CropBudget] = Field(default_factory=list, max_length=16)
    irrigation_source: Literal["farmer_reported", "water_users_board"] | None = None
    irrigation_allowance_m3_ha_season: float | None = Field(None, ge=0, le=1000000)
    use_team_templates_as_fallback: bool = False


@router.post("/economics")
def estimate_economics(req: EconomicsRequest):
    """No NASA fetch, no assumed farmgate prices, fully user-supplied inputs."""
    from app.services.agro_evidence import crop_economic_comparison
    expected = set(engine.load_catalog()["crops"])
    crop_ids = [p.crop_id for strategy in req.strategies for p in strategy.plantings]
    budget_ids = [p.crop_id for p in req.crop_budgets]
    if (any(cid not in expected for cid in crop_ids+budget_ids)
            or len(set(budget_ids)) != len(budget_ids)
            or len({s.id for s in req.strategies}) != len(req.strategies)):
        raise HTTPException(422, "Hay cultivos repetidos o no reconocidos.")
    return crop_economic_comparison(
        [s.model_dump() for s in req.strategies],
        [item.model_dump() for item in req.crop_budgets])


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
    # Use the farmer's selected parcel coordinates when supplied. A demo zone
    # is a contextual label, not the location of every farm in that valley.
    if zone and (lat is None or lon is None):
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


@router.get("/ai-demo")
def ai_demo(field: Literal["barranca-1"] = "barranca-1"):
    """Reproducible HLS training evidence, without invented crop labels."""
    try:
        model = field_ai.validated_barranca_model()
    except (OSError, ValueError, KeyError) as exc:
        return {"status": "not_verified", "source": "NASA HLS", "reason": type(exc).__name__}
    artifact = model["artifact"]
    observations = [{"month": x["month"], "ndvi": x["ndvi"]}
                    for x in model["observed"]]
    return {"status": "trained_and_verified", "field": field,
            "model_id": artifact["model_id"], "sensor": artifact["source_sensor"],
            "source_url": model["source"]["source_url"],
            "source_period": artifact["source_period"],
            "observed_months": artifact["observed_months"],
            "missing_months": artifact["missing_months"],
            "holdout": artifact["evaluation"],
            "real_ndvi_observations": observations,
            "seasonal_bare_probability":
                {str(i+1): model["probabilities"][i] for i in range(12)},
            "target": artifact["target"],
            "limitation_es": "El modelo aprende baja cobertura vegetal de una parcela, no identifica cultivos ni predice rendimientos."}


@router.get("/evidence-sources")
def evidence_sources():
    """Official source availability, not automatically a current observation."""
    from app.services.agro_evidence import public_evidence_summary
    return public_evidence_summary()


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
WAIT_SECONDS = float(os.getenv("TERRA360_HISTORY_WAIT") or 20)
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
    from app.application.rotation import compare_rotation
    if not req.current:
        return compare_rotation(req,{},None)
    clim=await _climate(req.zone,req.latitude,req.longitude)
    parcel=polygon_from_geojson(req.polygon) if req.polygon else None
    try:
        return compare_rotation(req,clim,parcel)
    except engine.RotationError as exc:
        raise HTTPException(422,str(exc)) from exc


@router.post("/spatial-plan")
async def spatial_plan(req: SpatialPlanRequest):
    """Three-step farmer experience: spatial crop assignments, dates and care.

    Requests can delineate valid farmland anywhere; local Lima calendars and
    trained HLS are limited to the geographies that support those claims.
    NASA POWER climatology enriches the reference calculation when available.
    """
    from shapely.geometry import shape
    from app.services.spatial_plan import build_spatial_plan
    polygon = polygon_from_geojson(req.polygon)
    try:
        centre = shape(polygon).centroid
        climate_data = None
        if -60 <= centre.y <= 60:
            try:
                climate_data = await asyncio.wait_for(
                    monthly_climate(centre.y, centre.x), timeout=10.0)
            except (ClimateError, ValueError, asyncio.TimeoutError):
                pass
        return build_spatial_plan(
            polygon, [zone.model_dump(exclude_none=True) for zone in req.zones],
            climate_data)
    except (ValueError, engine.RotationError) as exc:
        raise HTTPException(422, str(exc)) from exc

