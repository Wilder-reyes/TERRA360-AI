"""Train a candidate agricultural yield model only from real, consented field records.

BIOTEX does NOT ship a fabricated pre-trained agricultural model. This
trainer refuses synthetic/unconfirmed data, splits by *field* to reduce
memorisation, compares a simple baseline, and saves a candidate only if
evaluation clears explicit performance gates. An agronomist must independently
review any candidate before it is served in agricultural decisions.

CSV columns:
plot_code,consent,verified_by,zone,crop_id,season_start,
rain_30d_mm,temp_mean_c,ndvi_mean,soil_ph,water_m3_ha,yield_kg_ha
"""
from __future__ import annotations
import argparse
import csv
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ALLOWED_ZONES = {"barranca", "pativilca", "supe"}
FIELDS = ("rain_30d_mm", "temp_mean_c", "ndvi_mean", "soil_ph", "water_m3_ha")
COLUMNS = {"plot_code", "consent", "verified_by", "zone", "crop_id", "season_start", *FIELDS, "yield_kg_ha"}
MIN_RECORDS, MIN_FIELDS = 200, 30


def load_real_data(path: Path) -> list[dict]:
    if not path.is_file():
        raise ValueError("No CSV with genuine, consented agricultural campaign records is available.")
    with path.open(newline="", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        if not COLUMNS.issubset(set(reader.fieldnames or [])):
            raise ValueError("Missing required verified agricultural CSV columns.")
        rows = []
        for entry in reader:
            if entry["consent"].strip().lower() not in ("true", "yes", "si", "sí"):
                raise ValueError("All records must have explicit consent.")
            if entry["verified_by"] not in ("farmer", "agronomist"):
                raise ValueError("Unverified or synthetic crop records are not allowed.")
            if entry["zone"].strip().lower() not in ALLOWED_ZONES:
                raise ValueError("Only locally validated Barranca/Pativilca/Supe training records are allowed.")
            values = {field: float(entry[field]) for field in FIELDS}
            values["yield_kg_ha"] = float(entry["yield_kg_ha"])
            if not (0 <= values["rain_30d_mm"] <= 2000 and -5 <= values["temp_mean_c"] <= 55
                    and -1 <= values["ndvi_mean"] <= 1 and 0 <= values["soil_ph"] <= 14
                    and 0 <= values["water_m3_ha"] <= 100000
                    and 0 < values["yield_kg_ha"] <= 300000):
                raise ValueError("A field observation falls outside its physical validation bounds.")
            try:
                datetime.strptime(entry["season_start"], "%Y-%m")
            except ValueError as exc:
                raise ValueError("season_start must be a real YYYY-MM month.") from exc
            row = {**values,
                   "plot_code": entry["plot_code"].strip(),
                   "crop_id": entry["crop_id"].strip(),
                   "zone": entry["zone"].strip().lower()}
            if not row["plot_code"] or not row["crop_id"]:
                raise ValueError("An anonymized plot code and crop ID are required.")
            rows.append(row)
    distinct = {r["plot_code"] for r in rows}
    if len(rows) < MIN_RECORDS or len(distinct) < MIN_FIELDS:
        raise ValueError(f"Need at least {MIN_RECORDS} verified campaigns from {MIN_FIELDS} independent plots; got {len(rows)} / {len(distinct)}.")
    for field, count in Counter(r["plot_code"] for r in rows).items():
        if count > len(rows) // 4:
            raise ValueError(f"Plot {field!r} dominates too many samples.")
    return rows


def train_candidate(rows: list[dict], destination: Path, *, random_state: int = 42) -> dict:
    # ML-only dependencies deliberately outside the production backend.
    import pandas as pd
    import numpy as np
    from sklearn.compose import ColumnTransformer
    from sklearn.ensemble import HistGradientBoostingRegressor
    from sklearn.metrics import mean_absolute_error
    from sklearn.model_selection import GroupShuffleSplit
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import OneHotEncoder
    import joblib

    df = pd.DataFrame(rows)
    inputs = list(FIELDS) + ["crop_id", "zone"]
    groups = df["plot_code"]
    train_idx, test_idx = next(GroupShuffleSplit(n_splits=1, test_size=0.25,
                                                random_state=random_state).split(df, groups=groups))
    train, test = df.iloc[train_idx], df.iloc[test_idx]
    if len(set(test["plot_code"])) < 7 or len(set(train["plot_code"])) < 20:
        raise ValueError("Too few independent farms in train/test split.")
    base = float(np.median(train["yield_kg_ha"]))
    base_mae = float(mean_absolute_error(test["yield_kg_ha"],
                                        np.full(len(test), base)))
    preprocessing = ColumnTransformer([
        ("categories", OneHotEncoder(handle_unknown="ignore", sparse_output=False),
         ["crop_id", "zone"]),
    ], remainder="passthrough")
    pipeline = make_pipeline(
        preprocessing,
        HistGradientBoostingRegressor(max_iter=140, max_depth=4,
                                      min_samples_leaf=12, random_state=random_state))
    pipeline.fit(train[inputs], train["yield_kg_ha"])
    predictions = pipeline.predict(test[inputs])
    model_mae = float(mean_absolute_error(test["yield_kg_ha"], predictions))
    improvement = (base_mae - model_mae) / max(base_mae, 1e-8)
    report = {
        "state": "candidate_needs_independent_agronomist_validation"
                  if improvement >= .1 else "rejected_below_baseline_threshold",
        "train_samples": len(train), "holdout_samples": len(test),
        "train_fields": train["plot_code"].nunique(), "holdout_fields": test["plot_code"].nunique(),
        "target": "measured_yield_kg_ha", "mae_holdout": round(model_mae, 2),
        "baseline_median_mae": round(base_mae, 2),
        "relative_improvement": round(improvement, 4),
        "split": "field-disjoint (no crop observations from the same field in both sets)",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "not_approved_for_live_recommendation": True,
    }
    destination.parent.mkdir(parents=True, exist_ok=True)
    (destination.with_suffix(".validation.json")).write_text(
        json.dumps(report, indent=2), encoding="utf-8")
    if improvement >= .1:
        joblib.dump({"model": pipeline, "features": inputs, "report": report}, destination)
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("csv", type=Path, help="Real consented CSV, not demonstration or synthetic records")
    parser.add_argument("--output", type=Path, default=Path("backend/.cache/agro_model/candidate.joblib"))
    args = parser.parse_args()
    rows = load_real_data(args.csv)
    print(json.dumps(train_candidate(rows, args.output), indent=2))
