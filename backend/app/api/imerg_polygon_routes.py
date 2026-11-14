"""Read-only NASA IMERG V07 regional grid context for a declared polygon.

Public requests never trigger a protected Earthdata download.
"""
from datetime import date, timedelta
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator
from starlette.concurrency import run_in_threadpool
from app.services.imerg_polygon import daily_polygon_from_archive, IMERGPolygonError

router = APIRouter(prefix="/api/environment/gpm-imerg", tags=["NASA GPM regional rainfall"])


class IMERGPolygonRequest(BaseModel):
    polygon: dict
    target_date: date

    @field_validator("target_date")
    @classmethod
    def ensure_past_utc_date(cls, value: date):
        today = date.today()
        if not today - timedelta(days=365) <= value <= today - timedelta(days=2):
            raise ValueError("La fecha NASA debe estar entre 2 y 365 días antes de hoy.")
        return value


@router.post("/polygon-daily")
async def polygon_daily(payload: IMERGPolygonRequest):
    """Area-weighted *grid* precipitation, never parcel-scale actual rainfall."""
    try:
        return await run_in_threadpool(
            daily_polygon_from_archive,
            payload.polygon,
            payload.target_date,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except IMERGPolygonError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
