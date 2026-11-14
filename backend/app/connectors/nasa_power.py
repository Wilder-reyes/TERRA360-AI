from datetime import date, timedelta
import math
from typing import Any
import httpx

BASE_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
PARAMETERS = ["PRECTOTCORR", "T2M", "T2M_MAX", "T2M_MIN", "RH2M"]


class NasaPowerError(RuntimeError):
    """Raised when NASA POWER cannot return a valid response."""


async def fetch_daily_point(
    latitude: float,
    longitude: float,
    start: date,
    end: date,
    timeout: float = 45.0,
) -> dict[str, Any]:
    if start > end:
        raise ValueError("start must be on or before end")
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        raise ValueError("Invalid latitude/longitude")

    params = {
        "parameters": ",".join(PARAMETERS),
        "community": "AG",
        "longitude": longitude,
        "latitude": latitude,
        "start": start.strftime("%Y%m%d"),
        "end": end.strftime("%Y%m%d"),
        "format": "JSON",
        "time-standard": "UTC",
    }
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(BASE_URL, params=params)
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise NasaPowerError(f"NASA POWER request failed: {exc}") from exc

    if "properties" not in payload or "parameter" not in payload["properties"]:
        raise NasaPowerError("NASA POWER response did not contain properties.parameter")
    return payload


def normalize_daily(payload: dict[str, Any], start: date | None = None, end: date | None = None) -> dict[str, Any]:
    """Convert POWER's parameter->date dictionaries into row-oriented records.

    POWER missing values commonly use -999. Treat these as null, never as real data.
    """
    props = payload["properties"]
    params = props["parameter"]
    dates = sorted({day for values in params.values() for day in values})
    if (start is None) != (end is None):
        raise ValueError("Both start and end are required")
    if start is not None and end is not None:
        if start > end:
            raise ValueError("start must be on or before end")
        dates = [(start + timedelta(days=i)).strftime("%Y%m%d") for i in range((end-start).days+1)]
    records = []
    for day in dates:
        row = {"date": f"{day[:4]}-{day[4:6]}-{day[6:8]}"}
        for key in dict.fromkeys([*PARAMETERS, *params]):
            value = params.get(key, {}).get(day)
            row[key] = value if isinstance(value, (int, float)) and math.isfinite(value) and value != -999 else None
        records.append(row)

    return {
        "source": "NASA POWER",
        "source_url": BASE_URL,
        "community": "AG",
        "time_standard": "UTC",
        "spatial_representation": "POWER gridded point estimate; not an in-situ station measurement",
        "parameters": list(params.keys()),
        "units": {
            "PRECTOTCORR": "mm/day",
            "T2M": "degC",
            "T2M_MAX": "degC",
            "T2M_MIN": "degC",
            "RH2M": "%",
        },
        "missing_value_handling": "Missing dates, absent variables, -999 and nonfinite values converted to null",
        "records": records,
    }
