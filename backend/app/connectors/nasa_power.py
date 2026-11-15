from datetime import date
from typing import Any
import httpx

from app.source_contracts import POWER_BASE_URL as BASE_URL, POWER_PARAMETERS as PARAMETERS
# Compatibility import for historical scripts; implementation belongs to QA.
from app.quality.power import normalize_daily


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
