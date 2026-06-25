"""Forecast & regime metrics.

Regression : MAE, RMSE, MAPE (skipped where targets ~0 to avoid blow-up).
Quantile   : pinball (quantile) loss, prediction-interval coverage.
Regime     : state distribution, dwell-duration statistics, optional confusion
             matrix when ground-truth labels exist.

All functions are NumPy/pandas only and return plain dicts/DataFrames so they
serialise cleanly to JSON/CSV.
"""

from __future__ import annotations

from typing import Dict

import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# Regression
# ---------------------------------------------------------------------------
def mae(y_true, y_pred) -> float:
    y_true, y_pred = _clean(y_true, y_pred)
    return float(np.mean(np.abs(y_true - y_pred))) if len(y_true) else float("nan")


def rmse(y_true, y_pred) -> float:
    y_true, y_pred = _clean(y_true, y_pred)
    return float(np.sqrt(np.mean((y_true - y_pred) ** 2))) if len(y_true) else float("nan")


def mape(y_true, y_pred, eps: float = 1.0) -> float:
    """Mean absolute percentage error. Rows with |y_true| < eps are dropped to
    keep the metric meaningful (avoids division by ~0)."""
    y_true, y_pred = _clean(y_true, y_pred)
    mask = np.abs(y_true) >= eps
    if not mask.any():
        return float("nan")
    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100)


def regression_report(y_true, y_pred) -> Dict[str, float]:
    return {"mae": round(mae(y_true, y_pred), 4),
            "rmse": round(rmse(y_true, y_pred), 4),
            "mape_pct": round(mape(y_true, y_pred), 4)}


# ---------------------------------------------------------------------------
# Quantile
# ---------------------------------------------------------------------------
def pinball_loss(y_true, y_pred_q, q: float) -> float:
    """Pinball / quantile loss for quantile level q in (0,1)."""
    y_true, y_pred_q = _clean(y_true, y_pred_q)
    if not len(y_true):
        return float("nan")
    diff = y_true - y_pred_q
    return float(np.mean(np.maximum(q * diff, (q - 1) * diff)))


def interval_coverage(y_true, lower, upper) -> float:
    """Empirical coverage: fraction of y_true inside [lower, upper]."""
    y_true = np.asarray(y_true, dtype=float)
    lower = np.asarray(lower, dtype=float)
    upper = np.asarray(upper, dtype=float)
    m = ~np.isnan(y_true)
    if not m.any():
        return float("nan")
    inside = (y_true[m] >= lower[m]) & (y_true[m] <= upper[m])
    return float(np.mean(inside))


def quantile_report(y_true, q10, q50, q90) -> Dict[str, float]:
    return {
        "pinball_q10": round(pinball_loss(y_true, q10, 0.1), 4),
        "pinball_q50": round(pinball_loss(y_true, q50, 0.5), 4),
        "pinball_q90": round(pinball_loss(y_true, q90, 0.9), 4),
        "coverage_80pct": round(interval_coverage(y_true, q10, q90), 4),
    }


# ---------------------------------------------------------------------------
# Regime
# ---------------------------------------------------------------------------
def regime_distribution(regimes: pd.DataFrame, label_col: str = "regime_label"
                       ) -> Dict[str, float]:
    counts = regimes[label_col].value_counts(normalize=True)
    return {k: round(float(v), 4) for k, v in counts.items()}


def regime_duration_stats(regimes: pd.DataFrame, port_col: str = "port_id",
                          label_col: str = "regime_label") -> pd.DataFrame:
    """Mean/median/max dwell duration (in days) per regime, across ports."""
    runs = {}
    for _, g in regimes.groupby(port_col, sort=False):
        seq = g[label_col].to_numpy()
        if len(seq) == 0:
            continue
        cur, length = seq[0], 1
        for x in seq[1:]:
            if x == cur:
                length += 1
            else:
                runs.setdefault(cur, []).append(length)
                cur, length = x, 1
        runs.setdefault(cur, []).append(length)
    rows = []
    for label, lengths in runs.items():
        arr = np.array(lengths)
        rows.append({"regime_label": label, "n_episodes": len(arr),
                     "mean_days": round(float(arr.mean()), 2),
                     "median_days": float(np.median(arr)),
                     "max_days": int(arr.max())})
    return pd.DataFrame(rows).sort_values("regime_label").reset_index(drop=True)


def regime_confusion(y_true, y_pred, labels) -> pd.DataFrame:
    """Confusion matrix as a labelled DataFrame (only if true labels exist)."""
    idx = {l: i for i, l in enumerate(labels)}
    m = np.zeros((len(labels), len(labels)), dtype=int)
    for t, p in zip(y_true, y_pred):
        if t in idx and p in idx:
            m[idx[t], idx[p]] += 1
    return pd.DataFrame(m, index=[f"true_{l}" for l in labels],
                        columns=[f"pred_{l}" for l in labels])


# ---------------------------------------------------------------------------
def _clean(y_true, y_pred):
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    m = ~(np.isnan(y_true) | np.isnan(y_pred))
    return y_true[m], y_pred[m]
