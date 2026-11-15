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


class Subplot(BaseModel):
    id:str=Field(min_length=1,max_length=40)
    polygon:dict

class GeometryRequest(BaseModel):
    field:dict
    subplots:list[Subplot]=Field(max_length=10)

def verified_subplots(field:dict,subplots:list[Subplot])->dict:
    """Geometry validation, not cadastral ownership or botanical suitability."""
    from shapely.geometry import shape
    from pyproj import Geod
    geod=Geod(ellps="WGS84")
    try:
        outer=shape(field)
        if outer.geom_type!="Polygon" or not outer.is_valid or not outer.exterior.is_simple:
            raise ValueError("Polígono principal inválido")
        outer_area=abs(geod.geometry_area_perimeter(outer)[0])/10000
        if not .1<=outer_area<=500:
            raise ValueError("La parcela debe tener entre 0,1 y 500 ha")
        result=[]
        seen=[]
        for item in subplots:
            poly=shape(item.polygon)
            if poly.geom_type!="Polygon" or not poly.is_valid or not outer.covers(poly):
                raise ValueError("Una subparcela está fuera de la parcela principal o es inválida")
            area=abs(geod.geometry_area_perimeter(poly)[0])/10000
            if area<.01: raise ValueError("Subparcela demasiado pequeña")
            if any(poly.intersection(prev).area>1e-12 for prev in seen):
                raise ValueError("Las subparcelas no pueden solaparse")
            seen.append(poly)
            result.append({"id":item.id,"area_ha_approx":round(area,4),
                           "percent_of_field":round(area/outer_area*100,2)})
        return {
            "status":"geometry_validated_not_cadastral_or_agronomic",
            "field_area_ha_approx":round(outer_area,4),
            "subplots":result,
            "unallocated_area_ha_approx":round(max(0,outer_area-sum(row["area_ha_approx"] for row in result)),4),
            "crop_identity_verified":False,"land_ownership_verified":False,
        }
    except (TypeError,KeyError,ValueError,AttributeError) as exc:
        raise ValueError(str(exc)) from exc

@router.post("/validate-subplots")
def validate_subplots(req:GeometryRequest):
    try:return verified_subplots(req.field,req.subplots)
    except ValueError as exc:raise HTTPException(422,str(exc)) from exc

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
