"""SMAP L3 V006 9 km soil moisture context from private NASA archive."""
from datetime import date, timedelta
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator
from starlette.concurrency import run_in_threadpool

from app.services.smap_regional import regional_smap_from_archive, SMAPError

router = APIRouter(prefix="/api/environment/smap", tags=["NASA SMAP regional soil moisture"])


class SMAPRequest(BaseModel):
    polygon: dict
    target_date: date

    @field_validator("target_date")
    @classmethod
    def valid_date(cls, value: date):
        today = date.today()
        if not today - timedelta(days=365) <= value <= today - timedelta(days=2):
            raise ValueError("Fecha SMAP fuera de 2–365 días anteriores.")
        return value


@router.post("/regional-daily")
async def regional_daily(payload: SMAPRequest):
    """9 km AM DCA pixel; NEVER a plot-scale moisture sensor."""
    try:
        return await run_in_threadpool(regional_smap_from_archive,
                                       payload.polygon, payload.target_date)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except SMAPError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
