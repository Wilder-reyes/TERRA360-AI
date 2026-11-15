"""Stage 0 audit: describe classification on the existing temporal holdout.

Run from any directory: python docs/audit/reproduce_classification.py
No refitting choices or threshold tuning against holdout, and no artifact writes.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
from app.services import field_shift_ai as ai


def main():
    result = ai.reproduce_model()
    artifact = result["artifact"]
    rows = result["observed"][artifact["training"]["train_observations"]:]
    # These are fitted on the 33 training months, never the final 44-month fit.
    coefficients = artifact["evaluation"]["test_coefficients"]
    targets = [int(row["ndvi"] < ai.THRESHOLD) for row in rows]
    probabilities = [ai._probability(row["month"], coefficients) for row in rows]
    from app.ml.holdout_metrics import binary_holdout_metrics
    prevalence = sum(int(r['ndvi'] < ai.THRESHOLD) for r in result['observed'][:artifact['training']['train_observations']]) / artifact['training']['train_observations']
    metrics = binary_holdout_metrics(targets, probabilities, baseline_probability=prevalence)
    report = {
        'model_id': artifact['model_id'],
        'evaluation': 'chronological holdout; training-only coefficients, threshold 0.5 fixed',
        'n': len(rows),
        'target': 'monthly NASA HLS NDVI < 0.20; vegetation proxy only',
        **{k:v for k,v in metrics.items() if k not in ('status','test_observations','brier_model','brier_train_prevalence_baseline')},
        'brier_model_recomputed': metrics['brier_model'],
        'brier_train_prevalence_baseline': metrics['brier_train_prevalence_baseline'],
        'scope': 'one Barranca parcel, 11 temporal holdout months; no external spatial validation and no Chalhuas inference',
        'rows': [
            {'month': row['month'], 'target': t, 'probability': p, 'prediction': int(p >= 0.5)}
            for row,t,p in zip(rows, targets, probabilities)
        ],
    }
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
