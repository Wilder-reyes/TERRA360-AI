"""Serve dated risk screening without public downloads or notifications."""
from fastapi import APIRouter
from app.services.risk_alerts import catalog, latest_report

router = APIRouter(prefix="/api/agro/risks", tags=["Agricultural risk alerts"])


@router.get("/catalog")
def risk_catalog():
    return catalog()


@router.get("/report")
def risk_report():
    return latest_report()
