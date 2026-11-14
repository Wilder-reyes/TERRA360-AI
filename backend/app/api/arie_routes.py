from fastapi import APIRouter
from app.schemas.scenarios import ScenarioRequest
from app.services.arie import CROPS, REFERENCES, SCENARIOS, evaluate

router = APIRouter(prefix='/api/arie', tags=['ARIE - evidence-based scenarios'])

@router.get('/catalog')
def catalog():
    return {'pilot': None, 'location_type':'user_selected_query_point_not_parcel', 'crop_catalog_scope':'extended_taxonomic_directory_with_only_five_initial_evidence_profiles_no_global_suitability', 'crops':CROPS, 'references':REFERENCES, 'scenarios':SCENARIOS, 'limitations':'Crop profiles and FAO Kc are literature references, not measured field conditions.'}

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
