"""Bounded operator-only ingestion from fixed public Open-Meteo endpoints."""
from datetime import date, timedelta
import math

POINTS = [{"id": f"P{1 + row * 3 + col:02d}", "latitude": lat, "longitude": lon}
          for row, lat in enumerate((-13.25, -13.5, -13.75))
          for col, lon in enumerate((-72.25, -72.0, -71.75))]
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
HISTORY_VARIABLES = {"precipitation_sum": ("precipitation_mm", "mm", 0, 2000),
                     "soil_moisture_0_to_100cm_mean": ("soil_m3_m3", "m³/m³", 0, 1)}
FORECAST_VARIABLES = {"temperature_2m_min": ("tmin_c", "°C", -90, 65),
                      "temperature_2m_max": ("tmax_c", "°C", -90, 65),
                      "precipitation_sum": ("precipitation_mm", "mm", 0, 2000),
                      "et0_fao_evapotranspiration": ("et0_mm", "mm", 0, 50)}


def parameters(start: date, end: date, forecast=False):
    return {"latitude": ",".join(str(p["latitude"]) for p in POINTS),
            "longitude": ",".join(str(p["longitude"]) for p in POINTS),
            "timezone": "America/Lima", "elevation": ",".join("nan" for _ in POINTS), "cell_selection": "nearest",
            "models": "ecmwf_ifs025" if forecast else "era5",
            "daily": ",".join(FORECAST_VARIABLES if forecast else HISTORY_VARIABLES),
            "start_date": start.isoformat(), "end_date": end.isoformat()}


def normalize_points(payload, start, end, forecast=False):
    if not isinstance(payload, list) or len(payload) != len(POINTS):
        raise ValueError("Expected exactly nine weather locations")
    variables = FORECAST_VARIABLES if forecast else HISTORY_VARIABLES
    expected_dates = [start + timedelta(days=i) for i in range((end-start).days + 1)]
    normalized = []
    for index, (point, data) in enumerate(zip(POINTS, payload)):
        if data.get("location_id", index) != index or data.get("timezone") != "America/Lima" or data.get("utc_offset_seconds") != -18000:
            raise ValueError("Unexpected weather location order or timezone")
        grid = (data.get("latitude"), data.get("longitude"))
        if any(isinstance(v, bool) or not isinstance(v, (float, int)) or not math.isfinite(v) for v in grid):
            raise ValueError("Missing provider grid coordinates")
        if abs(grid[0] - point["latitude"]) > .001 or abs(grid[1] - point["longitude"]) > .001:
            raise ValueError("Provider grid differs from monitoring coordinates")
        daily = data.get("daily", {})
        times = daily.get("time", [])
        if not isinstance(times, list) or len(times) != len(set(times)):
            raise ValueError("Repeated weather dates")
        if any(day not in {d.isoformat() for d in expected_dates} for day in times):
            raise ValueError("Unexpected weather dates")
        indices = {day: i for i, day in enumerate(times)}
        rows = [{"date": day} for day in expected_dates]
        for key, (name, unit, lower, upper) in variables.items():
            if data.get("daily_units", {}).get(key) != unit:
                raise ValueError("Unexpected weather variable units: " + key)
            values = daily.get(key)
            if not isinstance(values, list) or len(values) != len(times):
                raise ValueError("Weather array length mismatch")
            for row in rows:
                at = indices.get(row["date"].isoformat())
                value = values[at] if at is not None else None
                row[name] = float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and lower <= value <= upper else None
        normalized.append({"grid": grid, "rows": rows})
    return normalized
