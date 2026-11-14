from fastapi import APIRouter, Query, HTTPException
from app.schemas.scenarios import ScenarioRequest
from app.services.arie import CROPS, REFERENCES, SCENARIOS, evaluate
from app.services.crop_search import search_directory
from app.services.farmer_crop_guidance import build_crop_guidance, annual_summaries_from_daily

router = APIRouter(prefix='/api/arie', tags=['ARIE - evidence-based scenarios'])

@router.get('/catalog')
def catalog():
    return {'pilot': None, 'location_type':'user_selected_query_point_not_parcel', 'crop_catalog_scope':'95_curated_plus_2568_FaoEcoCrop_estimates_no_regional_GAEZ_suitability', 'catalog_total':len(CROPS), 'crops':CROPS, 'references':REFERENCES, 'scenarios':SCENARIOS, 'limitations':'Crop profiles and FAO Kc are literature references, not measured field conditions.'}

@router.get('/crops')
def search_crops(query: str = Query('', max_length=80),
                 category: str | None = Query(None, max_length=45),
                 limit: int = Query(30, ge=1, le=100),
                 offset: int = Query(0, ge=0, le=10000)):
    return search_directory(CROPS, query=query, category=category, limit=limit, offset=offset)


@router.post('/evaluate')
def evaluate_scenario(request: ScenarioRequest):
    return evaluate(request)

@router.get('/decision-method')
def decision_method():
    from app.services.decision_ai import METHOD_VERSION, METHOD_REFERENCE
    return {"method": METHOD_VERSION, "reference": METHOD_REFERENCE,
            "kind": "symbolic_constraint_based_ai",
            "trained_predictive_model": False,
            "limitation": "Structural taxonomic screening; not local crop, water or yield optimization."}

@router.get('/parameters')
def parameter_catalog():
    import json
    from pathlib import Path
    path=Path(__file__).resolve().parents[1]/'data'/'parameter_catalog.json'
    return json.loads(path.read_text(encoding='utf-8'))


@router.get('/crop-guidance')
async def crop_guidance(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    selected_crop: str | None = Query(None, max_length=80),
):
    """NASA five completed years + FAO species ranges, for *exploration only*.

    No local suitability assertion. Expensive historical queries are
    initiated only on explicit farmer request from the crop page.
    """
    if selected_crop and selected_crop not in CROPS:
        raise HTTPException(422, detail="El cultivo seleccionado no existe en el catálogo.")
    from datetime import date
    from app.api.routes import point_metadata
    from app.connectors.nasa_power import (
        fetch_daily_point, normalize_daily, NasaPowerError,
    )
    last_year = date.today().year - 1
    first_year = last_year - 4
    start, end = date(first_year, 1, 1), date(last_year, 12, 31)
    try:
        # One NASA request, not five repeated queries for the same grid cell.
        raw = await fetch_daily_point(latitude, longitude, start, end)
        daily = normalize_daily(raw, start, end)["records"]
    except (NasaPowerError, ValueError) as exc:
        raise HTTPException(503, detail="NASA POWER no está disponible en este momento.") from exc
    records = annual_summaries_from_daily(daily, first_year, last_year)
    result = build_crop_guidance(records, selected_crop)
    return {
        **result,
        "point": point_metadata(latitude, longitude),
        "period": {"start_year": first_year, "end_year": last_year},
        "history": records,
        "source": "NASA POWER",
    }
