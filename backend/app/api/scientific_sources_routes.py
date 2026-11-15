"""Read-only provenance catalog. Does not fetch or invent observations."""
from fastapi import APIRouter
from app.services.scientific_registry import public_catalog

router = APIRouter(prefix="/api/environment", tags=["Scientific provenance"])


@router.get("/scientific-sources")
def scientific_sources():
    return public_catalog()
