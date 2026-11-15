"""Separated highland research pilot API; never calls the coastal rotation ranking."""
from __future__ import annotations
from datetime import date
from typing import Literal
import httpx
from fastapi import APIRouter,HTTPException,Query
from pydantic import BaseModel,Field
from app.services import andes_rotation
from app.services.era5_land_context import era5_land_context

router=APIRouter(prefix="/api/andes",tags=["Chalhuas exploratory pilot"])

class Comparison(BaseModel):
    rotation:list[str]=Field(min_length=4,max_length=4)
    start_year:int=Field(ge=2020,le=2035)
    priority:Literal["water","soil","both"]="both"

@router.get("/catalog")
def catalog():
    return andes_rotation.catalogue()

@router.post("/compare")
def compare(req:Comparison):
    try:
        return andes_rotation.compare(req.rotation,req.start_year,req.priority)
    except ValueError as exc:
        raise HTTPException(422,str(exc)) from exc

@router.get("/sources")
def sources():
    return {
        "place":{"name":"Chalhuas, Huáchac, Chupaca, Junín","latitude":-12.04700155,
                 "longitude":-75.36633862,"locator_type":"statistical_sector_reference",
                 "parcel_boundary_known":False},
        "layers":[
            {"id":"satellite","status":"available_base_map","source":"Esri World Imagery",
             "role":"visual_reference_not_agronomic_observation"},
            {"id":"vegetation","status":"available_regional_wms","source":"NASA GIBS MODIS Terra NDVI",
             "resolution":"250m nominal","role":"regional_observation_not_crop_identity"},
            {"id":"rain","status":"available_regional_wms","source":"NASA GIBS GPM IMERG",
             "resolution":"~10km","role":"regional_precipitation_not_irrigation"},
            {"id":"srtm","status":"existing_live_endpoint","path":"/api/environment/terrain",
             "source":"NASA/USGS SRTM 90m via Open Topo Data",
             "role":"approximate_elevation_not_field_slope"},
            {"id":"era5_land","status":"live_request_when_available","path":"/api/andes/era5-land",
             "source":"ECMWF ERA5-Land via Open-Meteo","role":"historical_regional_not_local_frost_alert"},
            {"id":"ecostress","status":"needs_quality_controlled_scene",
             "source":"NASA ECOSTRESS V003 via Earthdata",
             "source_url":"https://ecostress.jpl.nasa.gov/data",
             "role":"not_enabled_until_acquisition_qa_cloud_mask_validation"},
            {"id":"gldas","status":"research_only","source":"NASA GLDAS",
             "role":"regional_context_not_parcel"},
        ],
        "scientific_ai":{"status":"not_trained_for_chalhuas",
                         "barranca_model_transferred":False,
                         "needed":"Local HLS history, out-of-sample verification and agronomic validation"},
    }

@router.get("/era5-land")
async def era5_land(latitude:float=Query(...,ge=-90,le=90),
                    longitude:float=Query(...,ge=-180,le=180),
                    year:int=Query(default=2025,ge=2010,le=2030)):
    try:
        return await era5_land_context(latitude,longitude,year)
    except ValueError as exc:
        raise HTTPException(422,str(exc)) from exc
    except (httpx.HTTPError,TypeError,KeyError) as exc:
        raise HTTPException(503,"ERA5-Land no disponible en este momento; no se mostrarán valores inventados.") from exc
