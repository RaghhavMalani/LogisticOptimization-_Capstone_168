"""Conformalized Quantile Regression (CQR) calibration.

Our raw q10/q90 intervals were under-covering (~65% vs the nominal 80%). CQR
(Romano, Patterson & Candès, 2019) fixes this with a finite-sample coverage
guarantee: on a held-out calibration set we measure how far the true value falls
outside [q_lo, q_hi], take the (1-alpha) quantile of those conformity scores, and
widen (or tighten) the interval by that amount.

    conformity score   E_i = max(q_lo(x_i) - y_i,  y_i - q_hi(x_i))
    offset             Q   = ceil((n+1)(1-alpha))/n  quantile of {E_i}
    calibrated band    [q_lo - Q,  q_hi + Q]

This is model-agnostic (works for the baseline and the TFT) and leakage-safe as
long as the calibration set is disjoint from training and precedes the forecast.
"""

from __future__ import annotations

import numpy as np


def conformal_offset(y_true, q_lo, q_hi, alpha: float = 0.2) -> float:
    """Return the CQR offset Q for a target coverage of (1 - alpha)."""
    y = np.asarray(y_true, dtype=float)
    lo = np.asarray(q_lo, dtype=float)
    hi = np.asarray(q_hi, dtype=float)
    m = ~(np.isnan(y) | np.isnan(lo) | np.isnan(hi))
    y, lo, hi = y[m], lo[m], hi[m]
    n = len(y)
    if n < 10:
        return 0.0
    scores = np.maximum(lo - y, y - hi)
    level = min(1.0, np.ceil((n + 1) * (1 - alpha)) / n)
    try:
        return float(np.quantile(scores, level, method="higher"))
    except TypeError:  # older numpy
        return float(np.quantile(scores, level, interpolation="higher"))


def apply_offset(q_lo, q_hi, Q: float, lo_floor: float = 0.0):
    """Widen an interval by the conformal offset (clipped at a floor)."""
    lo = np.clip(np.asarray(q_lo, dtype=float) - Q, lo_floor, None)
    hi = np.asarray(q_hi, dtype=float) + Q
    return lo, hi
