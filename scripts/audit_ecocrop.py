"""Conservative, reproducible quality audit of the pinned FAO ECOCROP snapshot.

Flags are data-review signals, not corrections or agronomic suitability rules.
Original values remain unchanged. No external network access required.
"""
from __future__ import annotations

import argparse
from collections import Counter
import json
import math
from pathlib import Path

DEFAULT_SNAPSHOT = Path(__file__).resolve().parents[1] / "backend/app/data/ecocrop_species.json"
PAIRS = (
    ("tmin", "tmax"), ("topmn", "topmx"),
    ("rmin", "rmax"), ("ropmn", "ropmx"),
    ("gmin", "gmax"), ("phmin", "phmax"), ("phopmn", "phopmx"),
    ("latmn", "latmx"),
)
# Deliberately broad physical plausibility checks, not crop tolerance thresholds.
LIMITS = {
    "tmin": (-90, 70), "tmax": (-90, 70),
    "topmn": (-90, 70), "topmx": (-90, 70),
    "rmin": (0, 15000), "rmax": (0, 15000),
    "ropmn": (0, 15000), "ropmx": (0, 15000),
    "gmin": (0, 3650), "gmax": (0, 3650),
    "phmin": (0, 14), "phmax": (0, 14),
    "phopmn": (0, 14), "phopmx": (0, 14),
    "altmx": (-500, 9000), "latmn": (-90, 90), "latmx": (-90, 90),
}


def inspect_row(row: dict) -> list[str]:
    """Return sorted issue identifiers; never repair or discard the source row."""
    ecology = row.get("ecology")
    if not isinstance(ecology, dict):
        return ["missing_ecology"]
    flags = set()
    for field, (minimum, maximum) in LIMITS.items():
        value = ecology.get(field)
        if value is None:
            flags.add(f"missing:{field}")
        elif isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            flags.add(f"invalid_number:{field}")
        elif not minimum <= value <= maximum:
            flags.add(f"outside_broad_bounds:{field}")
    for low, high in PAIRS:
        a, b = ecology.get(low), ecology.get(high)
        if all(isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x) for x in (a, b)):
            if a > b:
                flags.add(f"inverted_range:{low}/{high}")
    # Optimum limits should be contained within general limits when all are valid.
    for low, high, opt_low, opt_high in (
        ("tmin", "tmax", "topmn", "topmx"),
        ("rmin", "rmax", "ropmn", "ropmx"),
        ("phmin", "phmax", "phopmn", "phopmx"),
    ):
        values = [ecology.get(k) for k in (low, high, opt_low, opt_high)]
        if all(isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x) for x in values):
            if values[0] <= values[1] and values[2] <= values[3] and (
                values[2] < values[0] or values[3] > values[1]
            ):
                flags.add(f"optimum_outside_general:{opt_low}/{opt_high}")
    return sorted(flags)


def audit(snapshot: dict) -> dict:
    if snapshot.get("locally_validated") is not False:
        raise ValueError("Snapshot must explicitly declare locally_validated=false")
    rows = snapshot.get("species")
    if not isinstance(rows, list):
        raise ValueError("Expected species list")
    counts = Counter()
    affected = []
    seen = set()
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get("id"), str) or not row["id"]:
            raise ValueError("Every species must have a non-empty string id")
        if row["id"] in seen:
            raise ValueError("Duplicate species id: " + row["id"])
        seen.add(row["id"])
        flags = inspect_row(row)
        counts.update(flags)
        if flags:
            affected.append({"id": row["id"], "scientific_name": row.get("scientific_name"), "flags": flags})
    return {
        "source": snapshot.get("source"),
        "source_sha256": snapshot.get("sha256"),
        "locally_validated": False,
        "scope": "Data quality audit only; bounds are screening heuristics, not biological thresholds.",
        "records": len(rows),
        "records_with_flags": len(affected),
        "flag_counts": dict(sorted(counts.items())),
        "records_flagged": affected,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_SNAPSHOT)
    parser.add_argument("--output", type=Path, help="Optional JSON output path")
    parser.add_argument("--summary-only", action="store_true", help="Omit per-species flags from stdout/output")
    args = parser.parse_args()
    report = audit(json.loads(args.input.read_text(encoding="utf-8")))
    if args.summary_only:
        report.pop("records_flagged")
    result = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(result, encoding="utf-8")
    print(result, end="")


if __name__ == "__main__":
    main()
