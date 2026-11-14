import os

from datetime import date, timedelta

from fastapi import APIRouter, HTTPException, Query
from starlette.concurrency import run_in_threadpool
from app.services.environment_metrics import (
    aggregate_nasa_power,
    aggregate_gpm_imerg,
)

from app.connectors.nasa_power import (
    fetch_daily_point,
    normalize_daily,
    NasaPowerError,
)
from app.connectors.gpm_imerg import (
    extract_daily_precipitation,
    GPMIMERGError,
)

router = APIRouter(prefix="/api", tags=["TERRA360"])

PILOT_NAME = "Calca, Cusco, Peru"
PILOT_LATITUDE = -13.32175
PILOT_LONGITUDE = -71.95605


def point_metadata(latitude: float, longitude: float) -> dict:
    """Never label a user-selected coordinate as the Calca town reference."""
    is_pilot = abs(latitude - PILOT_LATITUDE) < 0.00001 and abs(longitude - PILOT_LONGITUDE) < 0.00001
    return {
        "name": PILOT_NAME if is_pilot else "User-selected reference point",
        "latitude": latitude,
        "longitude": longitude,
        "coordinate_type": "town_reference_point" if is_pilot else "user_selected_query_point_not_surveyed_parcel",
    }




def _ensure_gpm_enabled():
    if os.getenv("GPM_DOWNLOADS_ENABLED", "true").lower() not in ("true", "1", "yes"):
        raise HTTPException(status_code=503, detail="GPM downloading is disabled on this public deployment.")


def determine_source_status(
    valid_count: int,
    total_count: int,
    error_count: int = 0,
) -> str:
    """Determine data availability for a source."""

    if valid_count == total_count and total_count > 0:
        return "available"

    if valid_count > 0:
        return "partial"

    if error_count == total_count and total_count > 0:
        return "error"

    return "no_data"


@router.get("/health")
async def health():
    return {
        "status": "ok",
        "application": "TERRA360",
        "version": "0.7.0",
    }


@router.get("/pilot")
async def pilot():
    return {
        "name": PILOT_NAME,
        "latitude": PILOT_LATITUDE,
        "longitude": PILOT_LONGITUDE,
        "coordinate_type": "town_reference_point",
        "warning": (
            "This is the town reference point, "
            "not a surveyed agricultural parcel."
        ),
        "source": "Coordinate reference from published locality information",
    }


@router.get("/environment/nasa-power/daily")
async def nasa_power_daily(
    start: date = Query(
        default_factory=lambda: date.today() - timedelta(days=30)
    ),
    end: date = Query(
        default_factory=lambda: date.today() - timedelta(days=1)
    ),
    latitude: float = Query(
        default=..., ge=-90, le=90
    ),
    longitude: float = Query(
        default=..., ge=-180, le=180
    ),
):
    if start > end:
        raise HTTPException(
            status_code=422,
            detail="'start' must be on or before 'end'.",
        )

    try:
        raw = await fetch_daily_point(latitude, longitude, start, end)
        result = normalize_daily(raw, start, end)

        result["location"] = point_metadata(latitude, longitude)
        result["period"] = {
            "start": start.isoformat(),
            "end": end.isoformat(),
        }

        return result

    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    except NasaPowerError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/environment/gpm-imerg/daily")
def gpm_imerg_daily(
    target_date: date = Query(
        default_factory=lambda: date.today() - timedelta(days=1)
    ),
    latitude: float = Query(
        default=..., ge=-90, le=90
    ),
    longitude: float = Query(
        default=..., ge=-180, le=180
    ),
):
    _ensure_gpm_enabled()
    try:
        return extract_daily_precipitation(
            target_date=target_date,
            latitude=latitude,
            longitude=longitude,
        )

    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    except GPMIMERGError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/environment/observations/daily")
async def environmental_observations_daily(
    start: date = Query(
        default_factory=lambda: date.today() - timedelta(days=30)
    ),
    end: date = Query(
        default_factory=lambda: date.today() - timedelta(days=1)
    ),
    latitude: float = Query(
        default=..., ge=-90, le=90
    ),
    longitude: float = Query(
        default=..., ge=-180, le=180
    ),
):
    """Retrieve daily observations from NASA POWER and GPM IMERG."""

    if start > end:
        raise HTTPException(
            status_code=422,
            detail="'start' must be on or before 'end'.",
        )

    _ensure_gpm_enabled()
    total_days = (end - start).days + 1
    if total_days > 31:
        raise HTTPException(status_code=422, detail="Maximum observation window is 31 days to limit GPM downloads.")

    dates = [
        start + timedelta(days=offset)
        for offset in range(total_days)
    ]

    sources = {}

    # NASA POWER: one request for the complete date range.
    try:
        raw_power = await fetch_daily_point(
            latitude,
            longitude,
            start,
            end,
        )

        power_data = normalize_daily(raw_power, start, end)

        power_records = power_data.get("records", [])

        valid_power_count = sum(
            any(
                value is not None
                for key, value in record.items()
                if key != "date"
            )
            for record in power_records
        )

        missing_power_count = total_days - valid_power_count

        power_status = determine_source_status(
            valid_power_count,
            total_days,
        )

        power_data["location"] = point_metadata(latitude, longitude)

        power_data["period"] = {
            "start": start.isoformat(),
            "end": end.isoformat(),
        }

        power_data["data_status"] = power_status
        power_data["valid_days"] = valid_power_count
        power_data["missing_days"] = max(0, missing_power_count)

        sources["nasa_power"] = {
            "status": power_status,
            "data": power_data,
        }

    except (NasaPowerError, ValueError) as exc:
        sources["nasa_power"] = {
            "status": "error",
            "message": str(exc),
        }

    # NASA GPM IMERG: retrieve each daily granule independently.
    gpm_records = []
    gpm_errors = []

    for current_date in dates:
        try:
            gpm_data = await run_in_threadpool(
                extract_daily_precipitation,
                current_date,
                latitude,
                longitude,
            )

            precipitation = gpm_data.get("precipitation_mm_day")

            gpm_records.append(gpm_data)

        except (GPMIMERGError, ValueError) as exc:
            gpm_errors.append({
                "date": current_date.isoformat(),
                "message": str(exc),
            })

            gpm_records.append({
                "date": current_date.isoformat(),
                "precipitation_mm_day": None,
                "missing_value": True,
            })

    valid_gpm_count = sum(
        record.get("precipitation_mm_day") is not None
        for record in gpm_records
    )

    gpm_status = determine_source_status(
        valid_gpm_count,
        total_days,
        len(gpm_errors),
    )

    sources["gpm_imerg"] = {
        "status": gpm_status,
        "data": {
            "source": "NASA GPM IMERG",
            "product": "GPM_3IMERGDL",
            "version": "07",
            "run": "Late",
            "variable": "precipitation",
            "unit": "mm/day",
            "spatial_resolution": "0.1 x 0.1 degree",
            "spatial_representation": (
                "Satellite-derived gridded estimate; "
                "not an in-situ station measurement"
            ),
            "period": {
                "start": start.isoformat(),
                "end": end.isoformat(),
            },
            "total_days": total_days,
            "valid_days": valid_gpm_count,
            "missing_days": total_days - valid_gpm_count,
            "records": gpm_records,
            "errors": gpm_errors,
        },
    }

    # Overall availability.
    source_statuses = [
        source["status"]
        for source in sources.values()
    ]

    if all(status == "available" for status in source_statuses):
        overall_status = "complete"
    elif any(status in ("available", "partial") for status in source_statuses):
        overall_status = "partial"
    else:
        overall_status = "unavailable"

    return {
        "period": {
            "start": start.isoformat(),
            "end": end.isoformat(),
            "total_days": total_days,
        },
        "location": point_metadata(latitude, longitude),
        "status": overall_status,
        "sources": sources,
    }


@router.get("/environment/metrics/daily")
async def environmental_metrics_daily(
    start: date = Query(
        default_factory=lambda: date.today() - timedelta(days=30)
    ),
    end: date = Query(
        default_factory=lambda: date.today() - timedelta(days=1)
    ),
    latitude: float = Query(
        default=..., ge=-90, le=90
    ),
    longitude: float = Query(
        default=..., ge=-180, le=180
    ),
):
    """Return aggregated environmental metrics from NASA sources."""

    observations = await environmental_observations_daily(
        start=start,
        end=end,
        latitude=latitude,
        longitude=longitude,
    )

    sources = observations["sources"]
    metrics = {}

    power_source = sources["nasa_power"]

    if "data" in power_source:
        metrics["nasa_power"] = {
            "status": power_source["status"],
            "data": aggregate_nasa_power(power_source["data"]),
        }
    else:
        metrics["nasa_power"] = power_source

    gpm_source = sources["gpm_imerg"]

    if "data" in gpm_source:
        metrics["gpm_imerg"] = {
            "status": gpm_source["status"],
            "data": aggregate_gpm_imerg(gpm_source["data"]),
        }
    else:
        metrics["gpm_imerg"] = gpm_source

    return {
        "period": observations["period"],
        "location": observations["location"],
        "status": observations["status"],
        "metrics": metrics,
    }

