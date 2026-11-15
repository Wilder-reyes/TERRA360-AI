"""Reproducible NASA HLS bare-surface seasonality model for ONE Barranca parcel.

The model is a trained logistic regression, NOT a generated crop label, yield
forecast or claim of soil improvement. Target = actual observed monthly NASA
HLS polygon-median NDVI < 0.20 (proxy for low vegetation cover).

Training data: the committed HLS 2021-2026 history JSON, sourced from individual
STAC records with cloud filtering. Missing months are ignored, never filled.
Chronological 75/25 split ensures holdout months occur AFTER training months.
The full model is only refit after the holdout evaluation, and persisted with
source blob SHA. Reproducible coefficients are independently recalculated here.

Use ONLY for the exact polygon from which its HLS observations were taken.
"""
from __future__ import annotations

from functools import lru_cache
import hashlib
import json
import math
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
ARTIFACT_PATH = ROOT / "data" / "models" / "barranca_hls_bare_v1.json"
THRESHOLD = 0.20
LAMBDA = 0.02
RATE = 0.13
ITERATIONS = 5000


def _feature(month: str) -> tuple[float, ...]:
    year, calendar_month = map(int, month.split("-"))
    theta = 2 * math.pi * (calendar_month - 1) / 12
    return (1.0, math.sin(theta), math.cos(theta),
            math.sin(2 * theta), math.cos(2 * theta), (year - 2021) / 6)


def _probability(month: str, coefficients: list[float] | tuple[float, ...]) -> float:
    x = max(-35.0, min(35.0, sum(w * v for w, v in zip(coefficients, _feature(month)))))
    return 1.0 / (1.0 + math.exp(-x))


def fit_logistic(observations: list[dict]) -> list[float]:
    """NumPy-free, fixed-step, L2-regularized logistic fit; deterministic."""
    if len(observations) < 15:
        raise ValueError("At least 15 observed HLS months required.")
    features = [_feature(m["month"]) for m in observations]
    targets = [1 if m["ndvi"] < THRESHOLD else 0 for m in observations]
    coefficients = [0.0] * 6
    for _ in range(ITERATIONS):
        gradient = [0.0] * 6
        for x, y in zip(features, targets):
            z = max(-35.0, min(35.0, sum(w * f for w, f in zip(coefficients, x))))
            p = 1.0 / (1.0 + math.exp(-z))
            for j in range(6):
                gradient[j] += (p - y) * x[j] / len(targets)
        for j in range(6):
            coefficients[j] -= RATE * (gradient[j] + (LAMBDA * coefficients[j] if j else 0.0))
    return coefficients


def _git_blob_sha(content: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(content)).encode() + b"\0" + content).hexdigest()


def _read_source_model() -> tuple[dict, list[dict], dict]:
    artifact = json.loads(ARTIFACT_PATH.read_text(encoding="utf-8"))
    # Source is fixed to the specific precomputed NASA-HLS dataset.
    expected = "data/history_seed/3365819f83a772e737d341ec1058efac.json"
    original = Path(artifact["source_path"])
    if original.as_posix() != "backend/app/" + expected:
        raise ValueError("Unexpected HLS source: cannot validate model provenance.")
    raw = (ROOT / expected).read_bytes()
    if _git_blob_sha(raw) != artifact["source_git_blob_sha"]:
        raise ValueError("HLS source has changed; retrain the model before use.")
    source = json.loads(raw)
    if source.get("sensor_id") != "hls" or source.get("example_field_id") != "barranca-1":
        raise ValueError("Source is not the validated NASA HLS Barranca field.")
    observed = [
        {"month": row["month"], "ndvi": row["ndvi"]}
        for row in source["months"]
        if isinstance(row.get("ndvi"), (float, int))
        and math.isfinite(row["ndvi"]) and -1 <= row["ndvi"] <= 1
    ]
    if len(observed) != artifact["observed_months"]:
        raise ValueError("Observed counts differ from the model artifact.")
    return artifact, observed, source


def reproduce_model() -> dict:
    """Re-fit train and complete models; reject altered coefficients or scores."""
    artifact, observed, source = _read_source_model()
    if artifact.get("model_id") != "biotex-barranca-hls-bare-v1":
        raise ValueError("Wrong model version.")
    cut = int(len(observed) * 0.75)
    train, test = observed[:cut], observed[cut:]
    if cut != artifact["training"]["train_observations"] or len(test) < 10:
        raise ValueError("Insufficient chronological test records.")
    test_coeff = fit_logistic(train)
    all_coeff = fit_logistic(observed)
    baseline = sum(row["ndvi"] < THRESHOLD for row in train) / len(train)
    brier_model = sum((_probability(row["month"], test_coeff) -
                       int(row["ndvi"] < THRESHOLD)) ** 2 for row in test) / len(test)
    brier_baseline = sum((baseline - int(row["ndvi"] < THRESHOLD)) ** 2
                         for row in test) / len(test)
    evaluation = artifact["evaluation"]
    if (max(abs(a - b) for a, b in zip(test_coeff, evaluation["test_coefficients"])) > 1e-8
            or max(abs(a - b) for a, b in zip(all_coeff, artifact["final_fit"]["coefficients"])) > 1e-8
            or abs(brier_model - evaluation["brier_model"]) > 1e-6
            or abs(brier_baseline - evaluation["brier_train_prevalence_baseline"]) > 1e-6):
        raise ValueError("Model coefficients or holdout results are not reproducible.")
    if brier_model >= brier_baseline or len(train) < 30:
        raise ValueError("HLS model failed the predeclared chronological holdout gate.")
    month_probs = [
        round(_probability(f"2026-{m:02d}", all_coeff), 6) for m in range(1, 13)
    ]
    if max(abs(x - y) for x, y in zip(
            month_probs, artifact["final_fit"]["predicted_probability_by_calendar_month"])) > 1e-5:
        raise ValueError("Published seasonal predictions are not reproducible.")
    return {"artifact": artifact, "observed": observed, "source": source,
            "probabilities": month_probs}


@lru_cache(maxsize=1)
def validated_barranca_model() -> dict:
    return reproduce_model()


def exact_parcel_match(polygon: dict) -> bool:
    """No reuse of this small-parcel model on other coordinates."""
    try:
        from app.services.hls_history import seed_path
        candidate = seed_path(polygon, 2021, "hls")
        return candidate.resolve() == (ROOT / "data/history_seed/3365819f83a772e737d341ec1058efac.json").resolve()
    except (TypeError, KeyError, ValueError):
        return False


def assess_strategies(polygon: dict | None, strategies: list[dict]) -> dict:
    """Return real-model evidence, or an explicit abstention for other fields."""
    if polygon is None or not exact_parcel_match(polygon):
        return {"status": "not_applicable_to_this_field", "used_for_decision": False}
    try:
        model = validated_barranca_model()
        artifact = model["artifact"]
        probabilities = model["probabilities"]
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as exc:
        return {"status": "model_not_verified", "used_for_decision": False,
                "reason": type(exc).__name__}
    risks: dict[str, float] = {}
    months_by_id: dict[str, list[dict]] = {}
    for s in strategies:
        if len(s.get("timeline", [])) != 24:
            continue
        timeline = s["timeline"]
        total = sum(probabilities[row["calendar_month"] - 1] for row in timeline)
        bare = sum(probabilities[row["calendar_month"] - 1]
                   for row in timeline if not row["covered"])
        if total:
            risks[s["id"]] = round(bare / total, 7)
            months_by_id[s["id"]] = [
                {"month": row["calendar_month"], "uncovered": not row["covered"],
                 "learned_bare_risk": probabilities[row["calendar_month"] - 1]}
                for row in timeline[:12]
            ]
    if "S0" not in risks:
        return {"status": "cannot_score_rotation", "used_for_decision": False}
    # These are exposure *proxies* from observed vegetation, not causal yields.
    return {
        "status": "trained_and_verified",
        "used_for_decision": True,
        "model_id": artifact["model_id"],
        "source_sensor": artifact["source_sensor"],
        "source_period": artifact["source_period"],
        "observed_months": artifact["observed_months"],
        "missing_months": artifact["missing_months"],
        "source_git_blob_sha": artifact["source_git_blob_sha"],
        "holdout": artifact["evaluation"],
        "seasonal_bare_probability": {str(i+1): probabilities[i] for i in range(12)},
        "weighted_uncovered_exposure": risks,
        "seasonal_explanations": [
            "Los meses con mayor probabilidad aprendida de vegetación baja se usan para comparar cobertura entre propuestas.",
            "El modelo fue entrenado para reconocer baja cobertura observada, no para identificar especies ni predecir cosechas.",
        ],
        "model_limitations": artifact["limits"],
    }
