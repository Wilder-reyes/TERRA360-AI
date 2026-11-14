"""Bounded, non-prescriptive vegetation reflectance analysis for user polygons."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.services.sentinel_ndvi import calculate_parcel_ndvi, NDVIError

router = APIRouter(prefix="/api/environment/sentinel-2", tags=["Sentinel-2 parcel analysis"])


class NDVIRequest(BaseModel):
    polygon: dict
    days: int = Field(120, ge=30, le=365)
    cloud_limit: float = Field(65, ge=0, le=100)


@router.post("/parcel-ndvi")
async def parcel_ndvi(payload: NDVIRequest):
    """Per-scene band pixel statistics, no agronomic recommendation."""
    try:
        return await calculate_parcel_ndvi(payload.polygon, days=payload.days,
                                           cloud_limit=payload.cloud_limit)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except NDVIError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


class NDVISeriesRequest(BaseModel):
    polygon: dict
    days: int = Field(180, ge=60, le=365)
    cloud_limit: float = Field(60, ge=0, le=100)
    max_observations: int = Field(4, ge=2, le=4)


@router.post("/parcel-ndvi-series")
async def parcel_ndvi_series(payload: NDVISeriesRequest):
    """Sparse observations of real pixels; no trend or agronomic interpretation."""
    from app.services.sentinel_timeseries import calculate_parcel_ndvi_series
    try:
        return await calculate_parcel_ndvi_series(
            payload.polygon, days=payload.days, cloud_limit=payload.cloud_limit,
            max_observations=payload.max_observations,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except NDVIError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
