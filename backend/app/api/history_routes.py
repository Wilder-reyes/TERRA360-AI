"""Bounded annual comparisons; never a climate trend or a yield forecast."""
import asyncio
import calendar
from datetime import date
from fastapi import APIRouter, Query, HTTPException
from app.connectors.nasa_power import fetch_daily_point, normalize_daily, NasaPowerError
from app.api.routes import point_metadata
from app.services.environment_metrics import calculate_statistics

router = APIRouter(prefix='/api/environment/nasa-power', tags=['Historical context'])

@router.get('/history')
async def history(latitude: float = Query(..., ge=-90, le=90),
                  longitude: float = Query(..., ge=-180, le=180),
                  end_year: int = Query(default_factory=lambda: date.today().year - 1, ge=1981),
                  years: int = Query(5, ge=3, le=10)):
    if end_year >= date.today().year or end_year - years + 1 < 1981:
        raise HTTPException(422, 'Use completed calendar years from 1981 onward.')
    semaphore = asyncio.Semaphore(2)
    async def annual(year):
        expected = 366 if calendar.isleap(year) else 365
        async with semaphore:
            try:
                raw = await fetch_daily_point(latitude, longitude, date(year, 1, 1), date(year, 12, 31))
                rows = normalize_daily(raw, date(year, 1, 1), date(year, 12, 31))['records']
                rain = calculate_statistics([r.get('PRECTOTCORR') for r in rows])
                temp = calculate_statistics([r.get('T2M') for r in rows], additive=False)
                return {'year': year, 'status': 'complete' if rain['count'] == expected and temp['count'] == expected else 'partial',
                        'expected_days': expected, 'valid_rain_days': rain['count'], 'valid_temperature_days': temp['count'],
                        'precipitation_total_mm': rain['total'] if rain['count'] == expected else None,
                        'available_precipitation_sum_mm': rain['total'], 'temperature_mean_c': temp['mean']}
            except (NasaPowerError, ValueError):
                return {'year': year, 'status': 'unavailable', 'expected_days': expected,
                        'precipitation_total_mm': None, 'temperature_mean_c': None}
    records = await asyncio.gather(*(annual(y) for y in range(end_year-years+1, end_year+1)))
    return {'source': 'NASA POWER', 'source_url': 'https://power.larc.nasa.gov/',
            'location': point_metadata(latitude, longitude), 'time_standard': 'UTC',
            'period': {'start_year': end_year-years+1, 'end_year': end_year}, 'records': records,
            'method': 'Separate full calendar years at the same requested grid point; incomplete rainfall totals withheld.',
            'limitation': 'Descriptive annual comparison, not a climate trend, climate normal or field measurement.',
            'is_climate_trend': False}

@router.get('/seasonality')
async def seasonality(latitude: float = Query(..., ge=-90, le=90),
                      longitude: float = Query(..., ge=-180, le=180),
                      years: int = Query(10, ge=5, le=15)):
    """On-demand monthly rain summary, not a farm-level forecast.

    Query years separately, at most 2 in parallel; no implicit polling.
    """
    from app.services.seasonality import monthly_values, summarize_months
    end_year=date.today().year-1
    if end_year-years+1 < 1981:
        raise HTTPException(422, 'Insufficient complete years from 1981.')
    semaphore=asyncio.Semaphore(2)
    async def one_year(year):
        async with semaphore:
            try:
                raw=await fetch_daily_point(latitude,longitude,date(year,1,1),date(year,12,31))
                return monthly_values(normalize_daily(raw,date(year,1,1),date(year,12,31))['records'],year)
            except (NasaPowerError,ValueError):
                return []
    values=await asyncio.gather(*(one_year(year) for year in range(end_year-years+1,end_year+1)))
    output=summarize_months([v for year in values for v in year])
    return {"source":"NASA POWER","source_url":"https://power.larc.nasa.gov/",
            "point":point_metadata(latitude,longitude),"time_standard":"UTC",
            "period":{"from":end_year-years+1,"to":end_year},**output}
