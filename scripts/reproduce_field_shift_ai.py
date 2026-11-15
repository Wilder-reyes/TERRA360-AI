"""Reproduce BIOTEX's trained NASA HLS parcel model from source data.

Example (run from repository root):
    python scripts/reproduce_field_shift_ai.py --check

No network or Earthdata credentials needed: the original NASA HLS STAC-derived
monthly NDVI records and frozen model are versioned under backend/app/data.
This script recomputes all coefficients and the chronological holdout scores.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"backend"))
from app.services.field_shift_ai import reproduce_model

def main()->int:
    parser=argparse.ArgumentParser()
    parser.add_argument("--check",action="store_true",help="Verify frozen HLS dataset, fitted coefficients and chronological holdout scores.")
    parser.add_argument("--report",type=Path,help="Optional output path for public validation metadata JSON.")
    args=parser.parse_args()
    try:
        result=reproduce_model()
        artifact=result["artifact"]
        report={
            "status":"reproduced",
            "model_id":artifact["model_id"],
            "source":artifact["source_path"],
            "source_blob_sha":artifact["source_git_blob_sha"],
            "source_sensor":artifact["source_sensor"],
            "observations_total":artifact["total_months"],
            "observations_valid":len(result["observed"]),
            "train_observations":artifact["training"]["train_observations"],
            "holdout_observations":artifact["training"]["holdout_observations"],
            "holdout_period":[artifact["training"]["holdout_first"],artifact["training"]["holdout_last"]],
            "holdout_brier_model":artifact["evaluation"]["brier_model"],
            "holdout_brier_baseline":artifact["evaluation"]["brier_train_prevalence_baseline"],
            "probabilities_by_calendar_month_2026":result["probabilities"],
            "warning":"Learned seasonal bare-surface proxy for one parcel; NOT validated crop identity, yield or farm irrigation data.",
        }
        if args.report:
            args.report.parent.mkdir(parents=True,exist_ok=True)
            args.report.write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
        print(json.dumps(report,indent=2,ensure_ascii=False))
        return 0
    except (OSError, ValueError, KeyError) as exc:
        print(f"MODEL REPRODUCIBILITY FAILED: {exc}",file=sys.stderr)
        return 1

if __name__=="__main__":
    raise SystemExit(main())
