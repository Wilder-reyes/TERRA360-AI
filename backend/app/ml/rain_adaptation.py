"""Chronological LoRA experiment helpers. No optional ML imports at module load."""
from __future__ import annotations

import hashlib
import json
from statistics import mean, median

from app.ml.chronos_rain import FOLD_MONTHS, MIN_CONTEXT_MONTHS, _quantiles, month_number

VALIDATION_MONTHS = 24
ADAPTATION_CONFIG = {
    "method": "lora", "rank": 8, "alpha": 16, "steps": 60,
    "learning_rate": 1e-5, "batch_size": 8, "context_length": 96,
    "seed": 2026, "minimum_validation_improvement": 0.05,
}
STUDY_CONFIGS = [dict(ADAPTATION_CONFIG),
                 {**ADAPTATION_CONFIG, "learning_rate": 1e-4, "steps": 120},
                 {**ADAPTATION_CONFIG, "learning_rate": 1e-3, "steps": 120}]


def chronological_split(months: list[dict], lead: int) -> dict:
    if lead not in (2, 3):
        raise ValueError("Use the next full month's two- or three-step lead")
    if any(month_number(b["month"]) - month_number(a["month"]) != 1 for a, b in zip(months, months[1:])):
        raise ValueError("Experiment months must be consecutive")
    test_start = len(months) - 2 * FOLD_MONTHS
    validation_stop = test_start - (lead - 1)
    validation_start = validation_stop - VALIDATION_MONTHS
    train_stop = validation_start - (lead - 1)
    if train_stop < MIN_CONTEXT_MONTHS:
        raise ValueError("Insufficient training history before validation and test embargoes")
    return {"train_stop": train_stop, "validation_start": validation_start,
            "validation_stop": validation_stop, "test_start": test_start,
            "test_stop": len(months), "lead_months": lead, "embargo_months": lead - 1}


def evaluation_windows(months: list[dict], start: int, stop: int, lead: int):
    contexts, targets, references = [], [], []
    for index in range(start, stop):
        context = months[:index - lead + 1]
        if len(context) < MIN_CONTEXT_MONTHS:
            raise ValueError("An evaluation origin has insufficient past observations")
        contexts.append([row["total_mm"] for row in context])
        targets.append(months[index]["total_mm"])
        references.append(median(row["total_mm"] for row in context if row["month"].month == months[index]["month"].month))
    return contexts, targets, references


def validation_sequences(months: list[dict], split: dict, context_length: int) -> list[list[float]]:
    """Chronos.fit validates the final `lead` values of each supplied sequence."""
    lead = split["lead_months"]
    return [[row["total_mm"] for row in months[max(0, index + 1 - context_length - lead):index + 1]]
            for index in range(split["validation_start"], split["validation_stop"])]


def score_outputs(outputs: list, targets: list[float], references: list[float], lead: int) -> dict:
    if not targets or len(outputs) != len(targets) or any(len(row) != lead for row in outputs):
        raise ValueError("Invalid experiment forecast dimensions")
    predictions = [_quantiles(row[-1]) for row in outputs]
    return {"examples": len(targets),
            "mae_mm": mean(abs(value - pred.median_mm) for value, pred in zip(targets, predictions)),
            "seasonal_mae_mm": mean(abs(value - ref) for value, ref in zip(targets, references)),
            "p10_p90_coverage": mean(pred.p10_mm <= value <= pred.p90_mm for value, pred in zip(targets, predictions))}


def select_on_validation(original: dict, adapted: dict, minimum_improvement: float = 0.05) -> str:
    """Selection takes no test inputs; ties and zero-reference-error keep original."""
    if original["examples"] != adapted["examples"] or original["examples"] < VALIDATION_MONTHS:
        raise ValueError("Compare the same validation origins")
    error = original["mae_mm"]
    improvement = (error - adapted["mae_mm"]) / error if error > 1e-8 else 0.0
    return "lora" if improvement >= minimum_improvement else "original"


def publish_adaptation(selected: str, test_folds: list[dict]) -> bool:
    """A held-out gate can reject release; it cannot select or retune weights."""
    if selected != "lora" or len(test_folds) != 2:
        return False
    return all(fold["seasonal_mae_mm"] > 1e-8
               and (fold["seasonal_mae_mm"] - fold["lora"]["mae_mm"]) / fold["seasonal_mae_mm"] >= 0.05
               and fold["lora"]["mae_mm"] < fold["original"]["mae_mm"] for fold in test_folds)


def best_development_candidate(candidates: list[dict]) -> dict:
    """Ignore any test metrics already stored in earlier experiment logs."""
    if not candidates:
        raise ValueError("No completed development candidates")
    return min(candidates, key=lambda item: (item["validation"]["lora"]["mae_mm"], item["experiment_id"]))


def experiment_id(records: list[dict], config: dict, split: dict) -> str:
    from app.ml.chronos_rain import MODEL_REVISION
    payload = {"records": records, "config": config, "split": split, "base_revision": MODEL_REVISION}
    return hashlib.sha256(json.dumps(payload, sort_keys=True, allow_nan=False, separators=(",", ":")).encode()).hexdigest()
