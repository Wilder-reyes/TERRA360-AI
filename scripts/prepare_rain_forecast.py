"""Prepare a real NASA POWER / Chronos-2 report outside the public web process.

PYTHONPATH=backend python -m scripts.prepare_rain_forecast --pilot
No synthetic fallback and no fine-tuning are performed.
"""
import argparse
import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path

from app.api.agro_routes import PILOT_PATH
from app.connectors.nasa_power import NasaPowerError
from app.ml.chronos_rain import ChronosPredictor, InsufficientRainHistory, ModelUnavailable
from app.schemas.rain_forecast import ForecastRequest
from app.services.rain_forecast import compute_report, fetch_rain_history, save_report


async def prepare(args):
    if args.pilot:
        pilot = json.loads(PILOT_PATH.read_text(encoding="utf-8"))
        location = ForecastRequest(**pilot["location"])
    else:
        location = ForecastRequest(latitude=args.latitude, longitude=args.longitude)
    today = datetime.now(timezone.utc).date()
    print(f"Retrieving 15 years of real NASA POWER rainfall at {location.latitude}, {location.longitude}…", flush=True)
    records, retrieved_at = await fetch_rain_history(location, today)
    predictor = None

    def predict(contexts, horizon):
        nonlocal predictor
        if predictor is None:
            print("Loading pinned pretrained Chronos-2 weights; no fine-tuning…", flush=True)
            predictor = ChronosPredictor(device=args.device, local_files_only=args.local_files_only)
        return predictor(contexts, horizon)

    report = compute_report(records, location, today, retrieved_at, predict)
    path = save_report(report, args.output_dir)
    print(f"Report: {path}", flush=True)
    print(f"Target: {report.target_month:%Y-%m}; median {report.prediction.median_mm:.1f} mm; model quantiles {report.prediction.p10_mm:.1f}–{report.prediction.p90_mm:.1f} mm")
    print(f"Retrospective comparison: {report.evaluation.status}")
    for fold in report.evaluation.folds:
        print(f"  {fold.from_month:%Y-%m}–{fold.to_month:%Y-%m}: MAE model {fold.mae_model_mm:.2f} mm / seasonal {fold.mae_seasonal_mm:.2f} mm")
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pilot", action="store_true", help="Use the documented Calca town reference")
    parser.add_argument("--latitude", type=float)
    parser.add_argument("--longitude", type=float)
    parser.add_argument("--device", choices=["cpu", "cuda"], default="cpu")
    parser.add_argument("--local-files-only", action="store_true")
    parser.add_argument("--output-dir", type=Path)
    args = parser.parse_args()
    if args.pilot and (args.latitude is not None or args.longitude is not None):
        parser.error("Use --pilot OR both coordinates")
    if not args.pilot and (args.latitude is None or args.longitude is None):
        parser.error("Use --pilot OR both --latitude and --longitude")
    try:
        asyncio.run(prepare(args))
    except (NasaPowerError, InsufficientRainHistory, ModelUnavailable, ValueError, OSError) as exc:
        parser.exit(1, f"No forecast report was produced: {exc}\n")


if __name__ == "__main__":
    main()
