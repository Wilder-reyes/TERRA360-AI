"""Descriptive multi-year rainfall seasonality; no forecast, ETc or soil water balance."""
from __future__ import annotations
import calendar
from collections import defaultdict
from datetime import date
from statistics import median


def monthly_values(records: list[dict], year: int, min_fraction: float = 1.0) -> list[dict]:
    groups: dict[int, list[float]] = defaultdict(list)
    for row in records:
        try:
            d = date.fromisoformat(str(row["date"]))
        except (KeyError, ValueError, TypeError):
            continue
        if d.year == year and isinstance(row.get("PRECTOTCORR"), (int,float)):
            import math
            value = float(row["PRECTOTCORR"])
            if math.isfinite(value) and value >= 0:
                groups[d.month].append(value)
    output = []
    for month in range(1, 13):
        n = calendar.monthrange(year, month)[1]
        values = groups[month]
        if len(values) >= n * min_fraction:
            output.append({"year":year,"month":month,"total_mm":round(sum(values),3),
                           "valid_days":len(values),"complete_enough":True})
        else:
            output.append({"year":year,"month":month,"total_mm":None,
                           "valid_days":len(values),"complete_enough":False})
    return output


def summarize_months(rows: list[dict], min_years_per_month: int = 5) -> dict:
    """Report median monthly rain only with adequate month coverage across years."""
    grouped = {i:[] for i in range(1, 13)}
    for row in rows:
        value = row.get("total_mm")
        if row.get("complete_enough") and value is not None:
            grouped[int(row["month"])].append(float(value))
    summaries=[]
    for month, values in grouped.items():
        summaries.append({"month":month, "years_with_data":len(values),
                          "median_rain_mm":round(median(values),2) if len(values)>=min_years_per_month else None,
                          "min_rain_mm":round(min(values),2) if len(values)>=min_years_per_month else None,
                          "max_rain_mm":round(max(values),2) if len(values)>=min_years_per_month else None})
    complete=[x["median_rain_mm"] for x in summaries if x["median_rain_mm"] is not None]
    # Do not label monthly rainfall as dry/wet without a calibrated, regional threshold.
    return {"months":summaries,"coverage_ok":len(complete)==12,"method":"monthly_rainfall_median_across_years",
            "is_forecast":False,
            "limitation":"Monthly observed historical rainfall is not forecast or crop water supply; incomplete months excluded."}
