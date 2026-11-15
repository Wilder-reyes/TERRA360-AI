"""Reproducible unsupervised NASA HLS vegetation-regime model for Barranca.

This is *trained on real satellite NDVI measurements*, not on fabricated
farmer labels. It does NOT learn true crop type, soil nutrients, irrigation
volumes, yield, profit or the "best" crop. Its output is evidence of observed
low vegetation that can change the soil-coverage priority in the independently
constrained FAO-56 / NASA POWER rotation optimizer.

Training: Barranca HLS v2.0 seed histories, years 2021-2025.
Holdout: all available 2026 observations, not used in fitting.
Estimator: deterministic 3-centroid k-means on NDVI; no imputation of clouds.
Training reproducibility: see scripts/train_hls_regimes.py.
"""
from __future__ import annotations
from collections import defaultdict
from hashlib import sha1
from pathlib import Path
from statistics import mean
import json
import math

SEED_DIR = Path(__file__).resolve().parents[1] / "data" / "history_seed"
MODEL_FILE = Path(__file__).resolve().parents[1] / "data" / "ai" / "barranca_hls_regimes_v1.json"
MODEL_VERSION = "biotex-hls-regimes-v1"
STATE_NAMES = ["vegetacion_baja", "vegetacion_media", "vegetacion_alta"]
TRAIN_END = "2025-12"
HOLDOUT_START = "2026-01"


def _git_blob_sha(data: bytes) -> str:
    return sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def _records(seed_dir: Path) -> tuple[list[dict], list[dict]]:
    all_rows: list[dict] = []
    files = []
    for path in sorted(seed_dir.glob("*.json")):
        raw = path.read_bytes()
        seed = json.loads(raw.decode("utf-8"))
        field = str(seed.get("example_field_id", ""))
        if not field.startswith("barranca-"):
            continue
        if "NASA HLS v2.0" not in str(seed.get("sensor", "")):
            continue
        files.append({"path": f"backend/app/data/history_seed/{path.name}",
                      "git_blob_sha": _git_blob_sha(raw),
                      "field_id": field, "valid_months_declared": seed.get("months_with_data")})
        for m in seed.get("months", []):
            value, scene = m.get("ndvi"), m.get("best_scene")
            if (not isinstance(value, (float, int)) or isinstance(value, bool)
                    or not math.isfinite(value) or not -1 <= value <= 1
                    or not isinstance(scene, dict)
                    or int(scene.get("valid_pixels") or 0) < 5):
                continue
            month = str(m.get("month", ""))
            if len(month) != 7 or not ("2021-01" <= month <= "2026-12"):
                continue
            all_rows.append({"field_id": field, "month": month, "ndvi": float(value)})
    return sorted(all_rows, key=lambda row: (row["field_id"], row["month"])), files


def nearest(centroids: list[float], value: float) -> int:
    return min(range(len(centroids)), key=lambda i: (abs(centroids[i]-value), i))


def fit_centroids(values: list[float], k: int = 3) -> list[float]:
    """Deterministic 1D k-means with observed-quantile initialisation."""
    if len(values) < 20:
        raise ValueError("Not enough observed NASA HLS NDVI values")
    ordered = sorted(values)
    seeds = [ordered[math.floor((len(ordered)-1)*q + 0.5)] for q in (0.15, 0.50, 0.85)]
    if len(set(seeds)) != k:
        raise ValueError("Observed NDVI values do not support three distinct regimes")
    centers = seeds
    for _ in range(100):
        buckets: list[list[float]] = [[] for _ in range(k)]
        for x in values:
            buckets[nearest(centers, x)].append(x)
        if any(not v for v in buckets):
            raise ValueError("Empty training cluster")
        updated = sorted(mean(v) for v in buckets)
        if max(abs(x-y) for x,y in zip(updated, centers)) < 1e-12:
            centers = updated
            break
        centers = updated
    return [round(c, 7) for c in centers]


def _transitions(rows: list[dict], centers: list[float]) -> list[list[float]]:
    """One-month transitions only. Missing months are not interpolated."""
    by_field: dict[str,list[dict]] = defaultdict(list)
    for row in rows:
        by_field[row["field_id"]].append(row)
    counts = [[1,1,1] for _ in range(3)]  # Laplace smooth sparse counts.
    for items in by_field.values():
        items.sort(key=lambda x: x["month"])
        for a, b in zip(items, items[1:]):
            ya, ma = map(int, a["month"].split("-"))
            yb, mb = map(int, b["month"].split("-"))
            if yb*12+mb-(ya*12+ma) != 1:
                continue
            counts[nearest(centers, a["ndvi"])][nearest(centers,b["ndvi"])] += 1
    return [[round(v/sum(row), 7) for v in row] for row in counts]


def _mse(vals: list[float], centers: list[float]) -> float:
    return mean((v-centers[nearest(centers,v)])**2 for v in vals)


def train_model(seed_dir: Path = SEED_DIR) -> dict:
    rows, files = _records(seed_dir)
    train = [r for r in rows if r["month"] <= TRAIN_END]
    holdout = [r for r in rows if r["month"] >= HOLDOUT_START]
    if (len(train) < 80 or len(holdout) < 12 or
            len({r["field_id"] for r in train}) < 3):
        raise ValueError("Insufficient real HLS training/holdout observations for Barranca")
    centers = fit_centroids([r["ndvi"] for r in train])
    test = [r["ndvi"] for r in holdout]
    base_mean = mean(r["ndvi"] for r in train)
    base_mse = mean((v-base_mean)**2 for v in test)
    model_mse = _mse(test, centers)
    if base_mse <= 0:
        raise ValueError("NASA HLS holdout variance is degenerate")
    reduction = 1-model_mse/base_mse
    if reduction < .15:
        raise ValueError("Regime model does not pass its 2026 holdout compactness gate")
    by_regime = [sum(nearest(centers, r["ndvi"])==k for r in train) for k in range(3)]
    transitions = _transitions(train, centers)
    return {
        "version": MODEL_VERSION,
        "status": "trained_unsupervised_nasa_hls",
        "region": "Barranca, Pativilca / Supe, Peru",
        "training_task": "vegetation_regime_clustering_not_crop_or_yield_prediction",
        "dataset": "NASA HLS v2.0, Landsat 8/9 and Sentinel-2, 30 m",
        "training_window": "2021-01 through 2025-12",
        "holdout_window": "2026-01 through 2026-11",
        "method": "Deterministic k-means (k=3) on valid observed field NDVI; no missing-value filling",
        "features": ["cloud_masked_hls_ndvi"],
        "model": {"state_names_es": STATE_NAMES, "centroids_ndvi": centers,
                  "transition_probabilities": transitions,
                  "train_observations_by_regime": by_regime},
        "validation": {
            "train_month_observations": len(train),
            "holdout_2026_observations": len(holdout),
            "training_example_polygons": len({x["field_id"] for x in train}),
            "train_one_centroid_mse_on_2026": round(base_mse, 7),
            "trained_kmeans_mse_on_2026": round(model_mse, 7),
            "holdout_distortion_reduction_vs_one_centroid": round(reduction, 5),
            "metric_interpretation": "Descriptive holdout reconstruction; not crop, soil or yield accuracy",
            "independent_farmer_validation": False,
        },
        "sources": files,
        "limitations_es": [
            "Las parcelas de entrenamiento son polígonos de estudio, no parcelas de agricultores verificados.",
            "NDVI bajo indica poca vegetación observada, no identifica el cultivo ni prueba mala salud del suelo.",
            "El conjunto de prueba de 2026 comparte zonas de entrenamiento; no demuestra generalización a otras regiones.",
            "La recomendación usa además NASA POWER y parámetros FAO-56; el modelo HLS solo ajusta el peso de cobertura del suelo.",
        ],
        "reproducibility": {
            "entrypoint": "python scripts/train_hls_regimes.py --check",
            "seed_data": "backend/app/data/history_seed/*.json",
            "fit_seed": "fixed observed quantiles 15%, 50%, 85%; no random-number generator",
            "holdout": "2026 withheld by calendar time",
        },
    }


def load_model() -> dict | None:
    try:
        model = json.loads(MODEL_FILE.read_text(encoding="utf-8"))
        if (model.get("version") != MODEL_VERSION or
                model.get("status") != "trained_unsupervised_nasa_hls" or
                len(model["model"]["centroids_ndvi"]) != 3):
            return None
        return model
    except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError):
        return None


def assess_field(history: dict | None, *, model: dict | None = None) -> dict:
    """Classify genuine cloud-free HLS months for one selected field.

    Returns an explicit unavailable state on missing data/model.
    No low-vegetation values are invented for cloudy months.
    """
    model = model if model is not None else load_model()
    if not model or not history or "NASA HLS v2.0" not in str(history.get("sensor","")):
        return {"status": "unavailable", "reason": "trained_model_or_hls_history_missing"}
    centers = model["model"]["centroids_ndvi"]
    months = [m for m in history.get("months",[]) if
              isinstance(m.get("ndvi"), (int,float)) and not isinstance(m.get("ndvi"), bool)
              and math.isfinite(m["ndvi"]) and m.get("best_scene")]
    latest_month = max((m["month"] for m in history.get("months", [])
                        if isinstance(m.get("month"), str) and len(m["month"]) == 7),
                       default=None)
    if not latest_month:
        return {"status": "insufficient_field_observations", "months_observed": 0}
    y, mo = map(int, latest_month.split("-"))
    first_ordinal = y*12+(mo-1)-23
    recent = sorted((m for m in months if
                     int(m["month"][:4])*12+int(m["month"][5:7])-1 >= first_ordinal),
                    key=lambda m:m["month"])
    if len(recent)<12:
        return {"status":"insufficient_field_observations", "months_observed":len(recent)}
    classification = [
        {"month": m["month"], "state": STATE_NAMES[nearest(centers,m["ndvi"])],
         "ndvi":round(m["ndvi"],4)} for m in recent
    ]
    low = sum(s["state"]==STATE_NAMES[0] for s in classification)
    fraction=low/len(classification)
    return {
        "status":"available","model_version":model["version"],
        "source":"NASA HLS v2.0 cloud-masked field NDVI (30 m)",
        "field_months_observed":len(classification),
        "low_vegetation_months":low,
        "low_vegetation_share":round(fraction,4),
        "cover_priority_multiplier":round(1+max(0,fraction-.25)*.8,4),
        "has_ground_truth_crops":False,
        "regimes":classification,
        "explanation_es":f"La IA identificó poca vegetación en {low} de {len(classification)} meses con imágenes utilizables. Por eso presta más atención a mantener el suelo con cultivos, si esa es tu prioridad.",
        "explanation_en":f"The model found low vegetation in {low} of {len(classification)} observed months. It gives more weight to soil cover when that matches your priority.",
        "limitations_es":"Poca vegetación observada no significa necesariamente suelo degradado ni identifica un cultivo.",
        "validation":model["validation"],
    }


def same_model(expected: dict, actual: dict) -> bool:
    """Verify reproducibility with tolerance for interpreter float formatting."""
    if (expected.get("version")!=actual.get("version") or
        expected.get("sources")!=actual.get("sources") or
        expected.get("validation")!=actual.get("validation")):
        return False
    for a,b in zip(expected["model"]["centroids_ndvi"],actual["model"]["centroids_ndvi"]):
        if abs(a-b)>1e-6:
            return False
    return expected["model"]["transition_probabilities"]==actual["model"]["transition_probabilities"]
