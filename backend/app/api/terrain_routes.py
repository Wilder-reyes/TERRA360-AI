"""Bounded, cached approximate SRTM90m terrain context via Open Topo Data.

No geodetic survey. SRTM derived DEM elevations are not field measurements.
Public API quota: max 1 request/second, 1000/day globally; this prototype
makes at most 50 upstream calls/day per Render worker and caches results.
"""
from __future__ import annotations
import asyncio
from datetime import date
from math import atan, cos, degrees, hypot, radians
from time import monotonic
from fastapi import APIRouter, HTTPException, Query
import httpx

router = APIRouter(prefix="/api/environment", tags=["Topography"])
LOCK = asyncio.Lock()
CACHE: dict[tuple[float,float], tuple[float,dict]] = {}
LAST_CALL = 0.0
DAILY_CALLS = 0
DAY = date.today()
SOURCE = "https://api.opentopodata.org/v1/srtm90m"
OFFSET_METERS = 180.0


def sampling_points(lat: float, lon: float) -> list[tuple[float,float]]:
    if not -59.95 <= lat <= 59.95 or not -179.98 <= lon <= 179.98:
        raise ValueError("Out of safe SRTM coverage or too near map edge")
    d_lat = OFFSET_METERS / 111_320.0
    d_lon = OFFSET_METERS / (111_320.0 * max(.1, abs(cos(radians(lat)))))
    return [(lat,lon),(lat+d_lat,lon),(lat-d_lat,lon),
            (lat,lon+d_lon),(lat,lon-d_lon)]


def summarize_elevation(payload: dict, points: list[tuple[float,float]]) -> dict:
    rows=payload.get("results")
    if not isinstance(rows,list) or len(rows)!=5:
        raise ValueError("Elevation service returned incomplete data")
    elevations=[]
    for row in rows:
        if not isinstance(row,dict) or row.get("dataset")!="srtm90m":
            raise ValueError("Unexpected SRTM data provider")
        v=row.get("elevation")
        if not isinstance(v,(int,float)) or isinstance(v,bool) or not (-500<=v<=9000):
            raise ValueError("Missing or implausible SRTM elevation")
        elevations.append(float(v))
    center,north,south,east,west=elevations
    # Neighbouring elevation samples +/-180 m, not the farmer's property.
    dx=(east-west)/(2*OFFSET_METERS)
    dy=(north-south)/(2*OFFSET_METERS)
    angle=degrees(atan(hypot(dx,dy)))
    return {
        "source":"NASA/USGS SRTM v3 90 m via Open Topo Data",
        "source_url":"https://www.opentopodata.org/datasets/srtm/",
        "elevation_m":round(center,1),
        "neighborhood_min_m":round(min(elevations),1),
        "neighborhood_max_m":round(max(elevations),1),
        "approximate_gradient_degrees":round(angle,2),
        "samples":5,
        "spacing_m":OFFSET_METERS,
        "resolution_m_approx":90,
        "representation":"five_DEM_samples_around_query_point_not_property",
        "can_decide_field_slope":False,
        "limitations":"Elevations are interpolated DEM estimates; steep terrain and the actual polygon cannot be measured reliably from five 90-m samples.",
    }


@router.get("/terrain")
async def terrain(
    latitude: float=Query(...,ge=-59.95,le=59.95),
    longitude: float=Query(...,ge=-179.98,le=179.98),
):
    global LAST_CALL, DAILY_CALLS, DAY
    key=(round(latitude,4),round(longitude,4))
    cached=CACHE.get(key)
    now=monotonic()
    if cached and now-cached[0]<24*3600:
        return cached[1]
    async with LOCK:
        now=monotonic()
        cached=CACHE.get(key)
        if cached and now-cached[0]<24*3600:
            return cached[1]
        today=date.today()
        if today!=DAY:
            DAY=today
            DAILY_CALLS=0
        if DAILY_CALLS>=50 or now-LAST_CALL<1.2:
            raise HTTPException(status_code=429,detail="Terrain service busy or public quota reached. Try later.",headers={"Retry-After":"15"})
        try:
            points=sampling_points(key[0],key[1])
        except ValueError:
            raise HTTPException(status_code=422,detail="SRTM unavailable for this latitude")
        params={"locations":"|".join(f"{lat:.6f},{lon:.6f}" for lat,lon in points),"interpolation":"bilinear"}
        LAST_CALL=now
        DAILY_CALLS+=1
        try:
            async with httpx.AsyncClient(timeout=12,follow_redirects=False) as client:
                response=await client.get(SOURCE,params=params,
                    headers={"Accept":"application/json","User-Agent":"TERRA360-AI-noncommercial-demo/0.9"})
                response.raise_for_status()
                result=summarize_elevation(response.json(),points)
        except (httpx.HTTPError,ValueError,TypeError,KeyError):
            raise HTTPException(status_code=503,detail="Unable to retrieve reliable elevation; try later")
        CACHE[key]=(monotonic(),result)
        # Bound memory if many unique coordinates are requested.
        if len(CACHE)>1000:
            for k in list(CACHE)[:250]:
                CACHE.pop(k,None)
        return result
