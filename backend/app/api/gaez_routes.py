"""FAO GAEZ v5 source selection and only verified raster-cell readouts."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool
from app.services.gaez_selected import selected_metadata, selected_raster_sample, GAEZError

router = APIRouter(prefix="/api/environment/gaez-v5", tags=["FAO GAEZ v5 provenance"])


class GAEZRequest(BaseModel):
    polygon: dict


@router.get("/selected-layer")
def selected_layer():
    """Returns catalog selection. Does not invent raster availability."""
    return selected_metadata()


@router.post("/selected-layer/sample")
async def sample_selected_layer(payload: GAEZRequest):
    try:
        return await run_in_threadpool(selected_raster_sample, payload.polygon)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except GAEZError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/selected-layer/raw-cell")
async def raw_original_cell(payload: GAEZRequest):
    """Real pinned FAO GeoTIFF byte code; never returns crop suitability %."""
    from app.services.gaez_original_raw import selected_original_cell, GAEZOriginalError
    try:
        return await run_in_threadpool(selected_original_cell, payload.polygon)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except GAEZOriginalError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
