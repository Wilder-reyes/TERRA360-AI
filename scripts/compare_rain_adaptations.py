"""Lock the best validation candidate, then compare it in the retrospective test."""
import asyncio
import hashlib
import json
from datetime import datetime, timezone

from app.api.agro_routes import PILOT_PATH
from app.ml.chronos_rain import ChronosPredictor, complete_rain_months, month_number
from app.ml.rain_adaptation import STUDY_CONFIGS, best_development_candidate, chronological_split, evaluation_windows, experiment_id, publish_adaptation, score_outputs, select_on_validation
from app.schemas.rain_forecast import ForecastRequest
from app.services.rain_forecast import BACKEND, atomic_json, fetch_rain_history, report_key


async def compare():
    location = ForecastRequest(**json.loads(PILOT_PATH.read_text())["location"])
    today = datetime.now(timezone.utc).date()
    records, _ = await fetch_rain_history(location, today, years=30)
    months = complete_rain_months(records, today)
    if not months or month_number(today) - month_number(months[-1]["month"]) not in (1, 2):
        raise ValueError("Recent complete observations required")
    lead = month_number(today) + 1 - month_number(months[-1]["month"])
    split = chronological_split(months, lead)
    root = BACKEND / "models" / "rain_adaptation"
    candidates = []
    for config in STUDY_CONFIGS:
        identity = experiment_id(records, config, split)
        directory = root / identity[:16]
        path = directory / "development.json"
        if not path.exists():
            path = directory / "comparison.json"
        if not path.exists():
            raise ValueError(f"Complete development candidate first: {identity[:16]}")
        item = json.loads(path.read_text())
        if item["experiment_id"] != identity or item["configuration"] != config or item["location"] != location.model_dump():
            raise ValueError("Candidate provenance mismatch")
        adapter = directory / "training" / "adapter" / "adapter_model.safetensors"
        if hashlib.sha256(adapter.read_bytes()).hexdigest() != item["adapter_sha256"]:
            raise ValueError("Adapter checksum mismatch")
        candidates.append(item)
    best = best_development_candidate(candidates)
    selected = select_on_validation(best["validation"]["original"], best["validation"]["lora"])
    study_id = hashlib.sha256(json.dumps([c["experiment_id"] for c in candidates], separators=(",", ":")).encode()).hexdigest()
    study_dir = root / "studies" / study_id[:16]
    study_dir.mkdir(parents=True, exist_ok=True)
    output = study_dir / "comparison.json"
    destination = BACKEND / "app" / "data" / "rain_experiments" / report_key(location)
    if output.exists():
        summary = json.loads(output.read_text())
        atomic_json(destination, summary)
        print(f"Reused locked comparison: {output}", flush=True)
        return summary
    selection = {"selected": selected, "chosen_using": "development_validation_only",
                 "original": best["validation"]["original"], "lora": best["validation"]["lora"]}
    atomic_json(study_dir / "selection_before_test.json", {**selection, "candidate_id": best["experiment_id"], "study_id": study_id})
    print("Locked validation selection:", json.dumps(selection), flush=True)

    original = ChronosPredictor(local_files_only=True)
    from chronos import Chronos2Pipeline
    adapted = object.__new__(ChronosPredictor)
    adapted.pipeline = Chronos2Pipeline.from_pretrained(
        str(root / best["experiment_id"][:16] / "training" / "adapter"), device_map="cpu", local_files_only=True,
    )
    folds = []
    for begin in (split["test_start"], split["test_start"] + 24):
        contexts, truth, reference = evaluation_windows(months, begin, begin + 24, lead)
        base = score_outputs(original(contexts, lead), truth, reference, lead)
        fine = score_outputs(adapted(contexts, lead), truth, reference, lead)
        folds.append({"from_month": months[begin]["month"].isoformat(), "to_month": months[begin + 23]["month"].isoformat(),
                      "original": base, "lora": fine, "seasonal_mae_mm": base["seasonal_mae_mm"]})
    summary = {**best, "experiment_id": study_id, "candidate_experiment_id": best["experiment_id"],
               "created_at": datetime.now(timezone.utc).isoformat(), "validation": selection,
               "test_folds": folds, "eligible_for_publication": publish_adaptation(selected, folds), "published": False,
               "records_sha256": hashlib.sha256(json.dumps(records, sort_keys=True, allow_nan=False, separators=(",", ":")).encode()).hexdigest(),
               "candidates": [{"experiment_id": c["experiment_id"], "learning_rate": c["configuration"]["learning_rate"],
                               "steps": c["configuration"]["steps"], "validation_mae_mm": c["validation"]["lora"]["mae_mm"]} for c in candidates],
               "limitations": ["Retrospective NASA data; the test periods were previously examined with the original model.",
                               "Three candidates selected using 24 validation targets from one regional series; not independent field observations.",
                               "No prospective validation, local interval calibration, spatial transfer or crop/irrigation validation."]}
    atomic_json(output, summary)
    atomic_json(destination, summary)
    for fold in folds:
        print(f"{fold['from_month']}–{fold['to_month']}: original={fold['original']['mae_mm']:.3f}, LoRA={fold['lora']['mae_mm']:.3f}, seasonal={fold['seasonal_mae_mm']:.3f} mm", flush=True)
    print(f"Metrics: {destination}; eligible={summary['eligible_for_publication']}; existing forecast preserved", flush=True)
    return summary


if __name__ == "__main__":
    asyncio.run(compare())
