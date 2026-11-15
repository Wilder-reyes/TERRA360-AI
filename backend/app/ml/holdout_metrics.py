"""Deterministic binary classification metrics for a FIXED, out-of-sample holdout.

Input probabilities must have been produced by coefficients fitted exclusively on
training observations. The decision threshold is predeclared; this module does
not fit or tune a classifier, and Brier is not an accuracy percentage.
"""
from __future__ import annotations
import math


def binary_holdout_metrics(targets: list[int], probabilities: list[float],
                           *, threshold: float = 0.5, baseline_probability: float | None = None) -> dict:
    if (not targets or len(targets) != len(probabilities)
            or not 0 < threshold < 1
            or baseline_probability is not None and not 0 <= baseline_probability <= 1):
        raise ValueError('A nonempty aligned holdout and valid predeclared threshold are required')
    if any(type(y) is not int or y not in (0, 1) for y in targets):
        raise ValueError('Binary targets must be observed 0/1 integers')
    if any(isinstance(p, bool) or not isinstance(p, (int, float))
           or not math.isfinite(p) or not 0 <= p <= 1 for p in probabilities):
        raise ValueError('Probabilities must be finite values within [0,1]')
    predictions = [int(p >= threshold) for p in probabilities]
    tp = sum(y == 1 and p == 1 for y, p in zip(targets, predictions))
    tn = sum(y == 0 and p == 0 for y, p in zip(targets, predictions))
    fp = sum(y == 0 and p == 1 for y, p in zip(targets, predictions))
    fn = sum(y == 1 and p == 0 for y, p in zip(targets, predictions))
    def pct(numerator: float, denominator: float) -> float | None:
        return 100 * numerator / denominator if denominator else None
    precision = pct(tp, tp + fp)
    recall = pct(tp, tp + fn)
    specificity = pct(tn, tn + fp)
    balanced = (recall + specificity)/2 if recall is not None and specificity is not None else None
    out = {
        'status': 'chronological_holdout',
        'decision_threshold': threshold,
        'test_observations': len(targets),
        'positive_count': sum(targets),
        'negative_count': len(targets) - sum(targets),
        'confusion_matrix': {'tp': tp, 'tn': tn, 'fp': fp, 'fn': fn},
        'accuracy_percent': pct(tp + tn, len(targets)),
        'precision_percent': precision,
        'recall_percent': recall,
        'specificity_percent': specificity,
        'balanced_accuracy_percent': balanced,
        'f1_percent': pct(2 * tp, 2 * tp + fp + fn),
        'brier_model': sum((p-y)**2 for y,p in zip(targets, probabilities))/len(targets),
    }
    if baseline_probability is not None:
        out['brier_train_prevalence_baseline'] = sum((baseline_probability-y)**2 for y in targets)/len(targets)
    return out
