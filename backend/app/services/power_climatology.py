# AI-assisted: written with Claude Code (Anthropic) and reviewed by the TERRA360 team.
"""Monthly water demand (ET0) and heat context from NASA POWER climatology.

NASA POWER's climatology endpoint returns long-term monthly means (the header
states the period, currently 2001-2025). ET0 is computed per month with the
FAO-56 Penman-Monteith equation (Allen et al., 1998, eq. 6 and ch. 3) from POWER
T2M_MAX, T2M_MIN, RH2M, WS2M and ALLSKY_SFC_SW_DWN.

Limits (declared to the user): POWER is a ~0.5° gridded estimate that can mix
desert coast, ocean and Andean slopes; it is not a field station. Values are
used only for RELATIVE comparisons between rotations.
"""
from __future__ import annotations

import asyncio
import math
import time
from typing import Any

import httpx

CLIMATOLOGY_URL = "https://power.larc.nasa.gov/api/temporal/climatology/point"
PARAMETERS = ["T2M_MAX", "T2M_MIN", "T2M", "RH2M", "WS2M", "ALLSKY_SFC_SW_DWN", "PRECTOTCORR"]
MONTH_KEYS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
DAYS_IN_MONTH = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
_CACHE: dict[str, tuple[float, dict]] = {}
_LOCK = asyncio.Lock()
CACHE_TTL = 12 * 3600


class ClimateError(RuntimeError):
    """NASA POWER could not provide a complete monthly climatology."""


def _svp(t: float) -> float:
    """Saturation vapour pressure, kPa (FAO-56 eq. 11)."""
    return 0.6108 * math.exp(17.27 * t / (t + 237.3))


def et0_penman_monteith(month: int, lat_deg: float, elevation_m: float,
                        tmax: float, tmin: float, rh: float, u2: float,
                        rs: float, t_prev: float | None = None,
                        t_next: float | None = None) -> float:
    """FAO-56 Penman-Monteith reference ET (mm/day) for a mid-month day."""
    tmean = (tmax + tmin) / 2
    pressure = 101.3 * ((293 - 0.0065 * elevation_m) / 293) ** 5.26
    gamma = 0.000665 * pressure
    es = (_svp(tmax) + _svp(tmin)) / 2
    ea = max(0.0, min(es, es * rh / 100))  # FAO-56 eq. 19 with mean RH
    delta = 4098 * _svp(tmean) / (tmean + 237.3) ** 2
    j = int(30.4 * month - 15)
    phi = math.radians(lat_deg)
    dr = 1 + 0.033 * math.cos(2 * math.pi * j / 365)
    decl = 0.409 * math.sin(2 * math.pi * j / 365 - 1.39)
    ws = math.acos(max(-1.0, min(1.0, -math.tan(phi) * math.tan(decl))))
    ra = (24 * 60 / math.pi) * 0.0820 * dr * (
        ws * math.sin(phi) * math.sin(decl) + math.cos(phi) * math.cos(decl) * math.sin(ws))
    rso = (0.75 + 2e-5 * elevation_m) * ra
    rns = 0.77 * rs
    ratio = min(1.0, rs / rso) if rso > 0 else 0.5
    rnl = 4.903e-9 * ((tmax + 273.16) ** 4 + (tmin + 273.16) ** 4) / 2 * (
        0.34 - 0.14 * math.sqrt(ea)) * (1.35 * ratio - 0.35)
    rn = rns - rnl
    # Monthly soil heat flux, FAO-56 eq. 43 (uses next/previous month means).
    g = 0.07 * (t_next - t_prev) if t_prev is not None and t_next is not None else 0.0
    et0 = (0.408 * delta * (rn - g) + gamma * 900 / (tmean + 273) * u2 * (es - ea)) / (
        delta + gamma * (1 + 0.34 * u2))
    return max(0.0, et0)


def build_monthly(payload: dict[str, Any], latitude: float, longitude: float) -> dict:
    try:
        params = payload["properties"]["parameter"]
        coords = payload.get("geometry", {}).get("coordinates", [longitude, latitude, 0])
    except (KeyError, TypeError) as exc:
        raise ClimateError("NASA POWER no devolvió parámetros.") from exc
    elevation = float(coords[2]) if len(coords) > 2 and isinstance(coords[2], (int, float)) else 0.0
    rows: dict[str, list[float]] = {}
    for p in PARAMETERS:
        series = params.get(p) or {}
        values = [series.get(k) for k in MONTH_KEYS]
        if any(not isinstance(v, (int, float)) or v == -999 or not math.isfinite(v) for v in values):
            raise ClimateError(f"NASA POWER no tiene los 12 meses de {p}.")
        rows[p] = [float(v) for v in values]
    tmean = rows["T2M"]
    months = []
    for i in range(12):
        et0 = et0_penman_monteith(i + 1, latitude, elevation, rows["T2M_MAX"][i],
                                  rows["T2M_MIN"][i], rows["RH2M"][i], rows["WS2M"][i],
                                  rows["ALLSKY_SFC_SW_DWN"][i], tmean[i - 1], tmean[(i + 1) % 12])
        months.append({
            "month": i + 1,
            "et0_mm_day": round(et0, 2),
            "et0_mm_month": round(et0 * DAYS_IN_MONTH[i], 1),
            "tmax_c": round(rows["T2M_MAX"][i], 2),
            "tmin_c": round(rows["T2M_MIN"][i], 2),
            "tmean_c": round(tmean[i], 2),
            "rh_percent": round(rows["RH2M"][i], 1),
            "wind_2m_m_s": round(rows["WS2M"][i], 2),
            "solar_mj_m2_day": round(rows["ALLSKY_SFC_SW_DWN"][i], 2),
            "rain_mm_month": round(rows["PRECTOTCORR"][i] * DAYS_IN_MONTH[i], 1),
        })
    # Relative heat months: the three months with highest POWER Tmax in THIS zone.
    hot = sorted(range(12), key=lambda i: (-rows["T2M_MAX"][i], i))[:3]
    tmax_range = max(rows["T2M_MAX"]) - min(rows["T2M_MAX"])
    header = payload.get("header", {}) if isinstance(payload.get("header"), dict) else {}
    return {
        "source": "NASA POWER climatology (community AG)",
        "source_url": CLIMATOLOGY_URL,
        "period": header.get("range", "multi-year climatology"),
        "latitude": latitude, "longitude": longitude,
        "power_grid_elevation_m": round(elevation, 1),
        "method": "ET0 FAO-56 Penman-Monteith (monthly means; G from eq. 43). Heat months = 3 months with the highest POWER T2M_MAX in this zone (relative, not a threshold).",
        "months": months,
        "hot_months": sorted(m + 1 for m in hot),
        "tmax_seasonal_range_c": round(tmax_range, 2),
        "annual_et0_mm": round(sum(m["et0_mm_month"] for m in months), 0),
        "limitations": [
            "Estimación en malla de ~50 km de NASA POWER; puede mezclar costa, mar y sierra. No es una estación en tu chacra.",
            "Se usa solo para comparar rotaciones entre sí (valores relativos).",
        ] + (["La Tmax de POWER casi no varía en esta zona (rango < 2 °C): los meses de calor son poco distintos entre sí."]
             if tmax_range < 2 else []),
        "limitations_en": [
            "NASA POWER ~50 km grid estimate; it can mix coast, ocean and Andes. It is not a station on your field.",
            "Used only to compare rotations with each other (relative values).",
        ] + (["POWER Tmax barely changes in this zone (range < 2 °C): warm months differ little."]
             if tmax_range < 2 else []),
    }


MOUNTAIN_CELL_M = 800
COASTAL_SHIFTS_DEG = (0.0, -0.15, -0.27, -0.4)


async def _fetch(client: httpx.AsyncClient, latitude: float, longitude: float) -> dict:
    response = await client.get(CLIMATOLOGY_URL, params={
        "parameters": ",".join(PARAMETERS), "community": "AG",
        "latitude": latitude, "longitude": longitude, "format": "JSON"})
    response.raise_for_status()
    return response.json()


def _cell_elevation(payload: dict) -> float:
    coords = (payload.get("geometry") or {}).get("coordinates") or []
    return float(coords[2]) if len(coords) > 2 and isinstance(coords[2], (int, float)) else 0.0


async def monthly_climate(latitude: float, longitude: float,
                          client: httpx.AsyncClient | None = None,
                          coastal: bool = True) -> dict:
    """POWER climatology for a coastal valley point.

    The POWER meteorology grid (~0.5° x 0.625°) can assign a coastal valley to an
    Andean cell (e.g. Huando's cell sits at ~2 100 m and has almost no seasonal
    Tmax cycle). With ``coastal=True`` and a cell above 800 m, the query moves
    west in small steps to the nearest lowland cell; the response records the
    point actually used and why.
    """
    if not (-60 <= latitude <= 60 and -180 <= longitude <= 180):
        raise ValueError("Coordenadas fuera de rango.")
    key = f"{latitude:.3f},{longitude:.3f},{coastal}"
    async with _LOCK:
        hit = _CACHE.get(key)
        if hit and time.monotonic() - hit[0] < CACHE_TTL:
            return hit[1]
    owned = client is None
    client = client or httpx.AsyncClient(timeout=httpx.Timeout(60.0))
    adjustment = None
    try:
        payload = await _fetch(client, latitude, longitude)
        query_lon = longitude
        if coastal and _cell_elevation(payload) > MOUNTAIN_CELL_M:
            original = _cell_elevation(payload)
            for shift in COASTAL_SHIFTS_DEG[1:]:
                candidate = await _fetch(client, latitude, longitude + shift)
                if _cell_elevation(candidate) <= MOUNTAIN_CELL_M:
                    payload, query_lon = candidate, longitude + shift
                    adjustment = {
                        "reason_es": f"La celda de NASA POWER del terreno está a {original:.0f} m (sierra); se usó la celda costera vecina a {_cell_elevation(candidate):.0f} m.",
                        "reason_en": f"The field's NASA POWER cell is at {original:.0f} m (Andes); the neighbouring coastal cell at {_cell_elevation(candidate):.0f} m was used.",
                        "original_cell_elevation_m": round(original, 1),
                        "query_point": [round(latitude, 4), round(query_lon, 4)],
                    }
                    break
    except (httpx.HTTPError, ValueError) as exc:
        raise ClimateError("NASA POWER no respondió.") from exc
    finally:
        if owned:
            await client.aclose()
    result = build_monthly(payload, latitude, query_lon)
    result["cell_adjustment"] = adjustment
    async with _LOCK:
        _CACHE[key] = (time.monotonic(), result)
    return result
