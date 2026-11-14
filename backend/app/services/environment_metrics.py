
from typing import Any
import math


def calculate_statistics(values: list[float | int | None], *, additive: bool = True) -> dict[str, Any]:
    """Calculate descriptive statistics while ignoring missing values."""

    valid_values = [
        float(value)
        for value in values
        if value is not None and math.isfinite(value)
    ]

    if not valid_values:
        return {
            "count": 0,
            "missing_count": len(values),
            "mean": None,
            "minimum": None,
            "maximum": None,
            "total": None,
        }

    return {
        "count": len(valid_values),
        "missing_count": len(values) - len(valid_values),
        "mean": round(sum(valid_values) / len(valid_values), 2),
        "minimum": round(min(valid_values), 2),
        "maximum": round(max(valid_values), 2),
        "total": round(sum(valid_values), 2) if additive else None,
    }


def aggregate_nasa_power(data: dict[str, Any]) -> dict[str, Any]:
    """Aggregate NASA POWER daily environmental observations."""

    records = data.get("records", [])

    precipitation = [
        record.get("PRECTOTCORR")
        for record in records
    ]

    temperature = [
        record.get("T2M")
        for record in records
    ]

    maximum_temperature = [
        record.get("T2M_MAX")
        for record in records
    ]

    minimum_temperature = [
        record.get("T2M_MIN")
        for record in records
    ]

    relative_humidity = [
        record.get("RH2M")
        for record in records
    ]

    return {
        "source": "NASA POWER",
        "precipitation_mm_day": calculate_statistics(precipitation),
        "temperature_c": calculate_statistics(temperature, additive=False),
        "maximum_temperature_c": calculate_statistics(maximum_temperature, additive=False),
        "minimum_temperature_c": calculate_statistics(minimum_temperature, additive=False),
        "relative_humidity_percent": calculate_statistics(relative_humidity, additive=False),
        "total_days": len(records),
    }


def aggregate_gpm_imerg(data: dict[str, Any]) -> dict[str, Any]:
    """Aggregate NASA GPM IMERG daily precipitation observations."""

    records = data.get("records", [])

    precipitation = [
        record.get("precipitation_mm_day")
        for record in records
    ]

    return {
        "source": "NASA GPM IMERG",
        "precipitation_mm_day": calculate_statistics(precipitation),
        "total_days": len(records),
    }
