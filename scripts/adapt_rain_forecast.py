"""Train one fixed-budget LoRA candidate using development data only.

PYTHONPATH=backend HF_HOME=/tmp/terra360-hf-cache python -m scripts.adapt_rain_forecast
Uses real NASA data. Test scoring lives exclusively in compare_rain_adaptations.
"""
import argparse
import asyncio
import hashlib
import importlib.metadata
import json
from datetime import datetime, timezone

from app.api.agro_routes import PILOT_PATH
from app.ml.chronos_rain import ChronosPredictor, MODEL_ID, MODEL_REVISION, complete_rain_months, month_number
from app.ml.rain_adaptation import ADAPTATION_CONFIG, chronological_split, evaluation_windows, experiment_id, score_outputs, select_on_validation, validation_sequences
from app.schemas.rain_forecast import ForecastRequest
from app.services.rain_forecast import BACKEND, atomic_json, fetch_rain_history


async def run(args):
    import numpy as np
    # Fail closed; Chronos otherwise silently falls back to full fine-tuning.
    import peft
    if peft.__version__ != "0.21.0":
        raise ValueError("Install peft==0.21.0 from requirements-ml-tuning.txt")
    from transformers import set_seed

    location = ForecastRequest(**json.loads(PILOT_PATH.read_text())["location"])
    today = datetime.now(timezone.utc).date()
    print("Reading 30 years of real NASA POWER data…", flush=True)
    records, _ = await fetch_rain_history(location, today, years=30)
    months = complete_rain_months(records, today)
    if not months or month_number(today) - month_number(months[-1]["month"]) not in (1, 2):
        raise ValueError("Recent complete observations are required")
    lead = month_number(today) + 1 - month_number(months[-1]["month"])
    split = chronological_split(months, lead)
    config = dict(ADAPTATION_CONFIG)
    config["learning_rate"] = args.learning_rate
    config["steps"] = args.steps
    identity = experiment_id(records, config, split)
    directory = BACKEND / "models" / "rain_adaptation" / identity[:16]
    directory.mkdir(parents=True, exist_ok=True)
    output = directory / "comparison.json"
    if output.exists():
        print(f"Existing completed experiment: {output}; not retraining or reselecting on its test.", flush=True)
        return json.loads(output.read_text())
    development = directory / "development.json"
    if development.exists():
        print(f"Existing development experiment: {development}; not retraining.", flush=True)
        return json.loads(development.read_text())
    if (directory / "protocol.json").exists():
        raise ValueError(f"An incomplete experiment exists at {directory}; review it before explicitly retrying")

    dates = {"train_from": months[0]["month"].isoformat(), "train_to": months[split["train_stop"] - 1]["month"].isoformat(),
             "validation_from": months[split["validation_start"]]["month"].isoformat(), "validation_to": months[split["validation_stop"] - 1]["month"].isoformat(),
             "test_from": months[split["test_start"]]["month"].isoformat(), "test_to": months[-1]["month"].isoformat()}
    protocol = {"id": identity, "config": config, "split": split, "dates": dates,
                "created_at": datetime.now(timezone.utc).isoformat(), "test_previously_examined": True,
                "selection_rule": "validation_mae_improvement_at_least_5_percent",
                "release_rule": "selected_lora_beats_seasonal_by_5_percent_and_original_in_both_test_blocks",
                "data_vintages": "retrospective_final_data_not_archived_vintages"}
    atomic_json(directory / "protocol.json", protocol)
    print("Split:", json.dumps(dates), flush=True)
    set_seed(config["seed"])
    original = ChronosPredictor(device=args.device, local_files_only=True)
    contexts, truth, reference = evaluation_windows(months, split["validation_start"], split["validation_stop"], lead)
    original_validation = score_outputs(original(contexts, lead), truth, reference, lead)

    print(f"LoRA: {config['steps']} steps; {split['train_stop']} training months; 24 validation targets. Test is excluded.", flush=True)
    tuned_pipeline = original.pipeline.fit(
        inputs=[np.asarray([row["total_mm"] for row in months[:split["train_stop"]]], dtype="float32")],
        prediction_length=lead,
        validation_inputs=[np.asarray(seq, dtype="float32") for seq in validation_sequences(months, split, config["context_length"])],
        finetune_mode="lora", context_length=config["context_length"],
        learning_rate=config["learning_rate"], num_steps=config["steps"], batch_size=config["batch_size"], min_past=24,
        output_dir=directory / "training", finetuned_ckpt_name="adapter",
        optim="adamw_torch", eval_steps=10, save_steps=10, logging_steps=10,
        seed=config["seed"], data_seed=config["seed"], disable_tqdm=True,
        dataloader_pin_memory=False, report_to="none",
    )
    adapted = object.__new__(ChronosPredictor)
    adapted.pipeline = tuned_pipeline
    adapted_validation = score_outputs(adapted(contexts, lead), truth, reference, lead)
    selected = select_on_validation(original_validation, adapted_validation, config["minimum_validation_improvement"])
    # Persist the decision before the first access to test targets for scoring.
    selection = {"selected": selected, "chosen_using": "development_validation_only",
                 "original": original_validation, "lora": adapted_validation}
    atomic_json(directory / "validation_selection.json", selection)
    print("Validation selection:", json.dumps(selection), flush=True)

    adapter_file = directory / "training" / "adapter" / "adapter_model.safetensors"
    adapter_sha = hashlib.sha256(adapter_file.read_bytes()).hexdigest()
    trainable, total = tuned_pipeline.model.get_nb_trainable_parameters()
    development_summary = {"schema_version": 1, "experiment_id": identity, "created_at": datetime.now(timezone.utc).isoformat(),
                           "as_of": today.isoformat(), "location": location.model_dump(), "model_id": MODEL_ID, "model_revision": MODEL_REVISION,
                           "history_months": len(months), "training_months": split["train_stop"], "independent_series": 1,
                           "lead_months": lead, "dates": dates, "configuration": config,
                           "adapter_sha256": adapter_sha, "trainable_parameters": trainable, "total_parameters": total,
                           "packages": {name: importlib.metadata.version(name) for name in ("chronos-forecasting", "peft", "torch", "transformers")},
                           "validation": selection, "test_previously_examined": True}
    atomic_json(development, development_summary)
    print(f"Development only; no test scoring: {development}", flush=True)
    return development_summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--device", choices=["cpu", "cuda"], default="cpu")
    parser.add_argument("--learning-rate", type=float, default=ADAPTATION_CONFIG["learning_rate"])
    parser.add_argument("--steps", type=int, default=ADAPTATION_CONFIG["steps"])
    parser.add_argument("--development-only", action="store_true", help="Explicit development-only mode (also the default)")
    args = parser.parse_args()
    if not 1e-6 <= args.learning_rate <= 1e-3 or not 10 <= args.steps <= 200:
        parser.error("Use learning rates 1e-6..1e-3 and 10..200 steps")
    asyncio.run(run(args))


if __name__ == "__main__":
    main()
