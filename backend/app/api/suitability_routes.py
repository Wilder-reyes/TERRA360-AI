"""Regional agricultural suitability from packaged, verified FAO model outputs."""
import logging

from fastapi import APIRouter, HTTPException
from starlette.concurrency import run_in_threadpool

from app.schemas.suitability import SuitabilityRequest
from app.services.suitability import catalog, suitability_map, SuitabilityDataError, SuitabilityExtentError

router = APIRouter(prefix="/api/agro/suitability", tags=["Agricultural suitability mapping"])
logger = logging.getLogger(__name__)


@router.get("/catalog")
def suitability_catalog():
    try:
        return catalog()
    except SuitabilityDataError:
        raise HTTPException(503, "Suitability sources are unavailable")


@router.post("/map")
async def map_suitability(request: SuitabilityRequest):
    try:
        return await run_in_threadpool(suitability_map, request)
    except SuitabilityExtentError as exc:
        raise HTTPException(422, str(exc))
    except SuitabilityDataError:
        logger.exception("Packaged FAO suitability source failed verification")
        raise HTTPException(503, "Suitability data could not be verified")
