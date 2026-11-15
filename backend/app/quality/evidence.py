"""Pure quality metadata for NASA POWER daily API payloads.

Completeness counts actual finite values, not simply the existence of a date row.
No partial-year precipitation sum is described as an annual total.
"""
from __future__ import annotations
from datetime import date
from math import isfinite
from typing import Any

VARIABLES = ("PRECTOTCORR", "T2M", "T2M_MAX", "T2M_MIN", "RH2M")


def daily_coverage(records: list[dict[str, Any]], start: date, end: date) -> dict[str, Any]:
    if start > end:
        raise ValueError("end precedes start")
    expected_days = (end - start).days + 1
    # Ignore dates outside the requested range, and never count a duplicated date twice.
    in_period = {
        str(row.get("date")): row for row in records if isinstance(row, dict)
        and isinstance(row.get("date"), str)
        and start.isoformat() <= row["date"] <= end.isoformat()
    }
    valid_days: dict[str, int] = {}
    for variable in VARIABLES:
        valid_days[variable] = sum(
            1 for row in in_period.values()
            if isinstance(row.get(variable), (int, float))
            and not isinstance(row.get(variable), bool)
            and isfinite(row[variable])
        )
    return {
        "period_start": start.isoformat(),
        "period_end": end.isoformat(),
        "expected_days": expected_days,
        "calendar_days_represented": len(in_period),
        "valid_days_by_variable": valid_days,
        "coverage_percent_by_variable": {
            var: round(100 * min(count, expected_days) / expected_days, 1)
            for var, count in valid_days.items()
        },
        "completeness": "complete" if all(n == expected_days for n in valid_days.values()) else "partial",
        "spatial_interpretation": "regional_gridded_point_not_in_situ_field_measurement",
        "missing_days_are_zero": False,
    }
