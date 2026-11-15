"""ERA5-Land historical climate context for a sector, not a parcel-level frost warning.

Open-Meteo (data relay) explicitly requested with models=era5_land, using
Copernicus ERA5-Land reanalysis. Cache/timeout bound public-demo traffic.
"""
from __future__ import annotations
from datetime import date
from time import monotonic
import asyncio
import httpx

_SOURCE="https://archive-api.open-meteo.com/v1/archive"
_DOC="https://open-meteo.com/en/docs/historical-weather-api"
_CACHE:dict[tuple[float,float,int],tuple[float,dict]]={}
_LOCK=asyncio.Lock()
_DAY=date.today()
_DAILY_CALLS=0
_LAST_REQUEST=0.0
class ERA5QuotaExceeded(RuntimeError):
    """Bounded public demo request budget; retry after previous requests settle."""


def summarize_era5_land(payload:dict,year:int)->dict:
    daily=payload.get("daily") or {}
    dates=daily.get("time") or []
    mins=daily.get("temperature_2m_min") or []
    rains=daily.get("precipitation_sum") or []
    if not isinstance(dates,list) or len(dates)<350 or len(dates)!=len(mins) or len(dates)!=len(rains):
        return {"status":"insufficient_data","year":year,"reason":"Incomplete daily ERA5-Land series; no values asserted"}
    clean=[(d,float(t),float(r)) for d,t,r in zip(dates,mins,rains)
           if d.startswith(str(year)+"-") and isinstance(t,(int,float)) and not isinstance(t,bool)
           and isinstance(r,(int,float)) and not isinstance(r,bool)
           and -60<=t<=60 and 0<=r<=2000]
    if len(clean)<340:
        return {"status":"insufficient_data","year":year,"valid_days":len(clean),"reason":"Insufficient valid daily observations"}
    months=[]
    for m in range(1,13):
        subset=[(t,r) for d,t,r in clean if d[5:7]==f"{m:02d}"]
        months.append({"month":m,"min_air_temperature_c":round(min((t for t,r in subset),default=100),1) if subset else None,
                       "rainfall_sum_mm":round(sum(r for t,r in subset),1) if subset else None,
                       "valid_days":len(subset)})
    return {
        "status":"available","dataset":"ECMWF ERA5-Land via Open-Meteo historical archive",
        "year":year,"model":"era5_land",
        "source_url":_DOC,"spatial_support":"regional_model_grid_approximately_9_to_11_km",
        "not_field_measurement":True,"not_frost_forecast":True,
        "valid_days":len(clean),
        "min_air_temperature_c":round(min(x[1] for x in clean),1),
        "days_at_or_below_zero_c":sum(x[1]<=0 for x in clean),
        "rainfall_sum_mm":round(sum(x[2] for x in clean),1),
        "months":months,
        "limitation_es":"Reanálisis de una celda regional. La temperatura real de una chacra puede diferir mucho por la altitud y el relieve; no predice heladas futuras.",
    }

async def era5_land_context(latitude:float,longitude:float,year:int)->dict:
    if not -12.6<=latitude<=-11.5 or not -75.9<=longitude<=-74.8:
        raise ValueError("Este piloto de ERA5-Land se limita al sector de Chupaca y alrededores.")
    if year<2010 or year>=date.today().year:
        raise ValueError("Selecciona un año completo entre 2010 y el año pasado.")
    key=(round(latitude,3),round(longitude,3),year)
    found=_CACHE.get(key)
    if found and monotonic()-found[0]<86400:return found[1]
    params={"latitude":key[0],"longitude":key[1],
            "start_date":f"{year}-01-01","end_date":f"{year}-12-31",
            "daily":"temperature_2m_min,precipitation_sum","timezone":"America/Lima",
            "models":"era5_land"}
    global _DAY,_DAILY_CALLS,_LAST_REQUEST
    async with _LOCK:
        found=_CACHE.get(key)
        if found and monotonic()-found[0]<86400:return found[1]
        if date.today()!=_DAY:
            _DAY=date.today()
            _DAILY_CALLS=0
        if _DAILY_CALLS>=50 or monotonic()-_LAST_REQUEST<1.2:
            raise ERA5QuotaExceeded("Cuota pública del reanálisis alcanzada: intenta de nuevo después.")
        _DAILY_CALLS+=1
        _LAST_REQUEST=monotonic()
        async with httpx.AsyncClient(timeout=18,follow_redirects=False) as client:
            r=await client.get(_SOURCE,params=params,headers={"Accept":"application/json","User-Agent":"BIOTEX-Research-Pilot/0.28"})
            r.raise_for_status()
            result=summarize_era5_land(r.json(),year)
        if result["status"]=="available":
            if len(_CACHE)>=64:_CACHE.clear()
            _CACHE[key]=(monotonic(),result)
        return result
