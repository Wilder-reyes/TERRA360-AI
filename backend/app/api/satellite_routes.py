"""Optional, credential-free satellite scene search for the selected location."""
from fastapi import APIRouter, HTTPException, Query
from app.connectors.planetary_computer import search_scenes, SceneCatalogError

router = APIRouter(prefix="/api/environment/planetary-computer", tags=["Satellite observations"])

@router.get("/scenes")
async def available_scenes(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    days: int = Query(120, ge=30, le=365),
    cloud_limit: float = Query(35, ge=0, le=100),
    count: int = Query(5, ge=1, le=10),
):
    try:
        return await search_scenes(latitude, longitude, days=days,
                                   cloud_limit=cloud_limit, count=count)
    except SceneCatalogError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
