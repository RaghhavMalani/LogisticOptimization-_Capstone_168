"""Shared helpers for expert modules.

All transforms here are **row-wise or strictly backward-looking** so that an
expert never uses future information to build a feature for a past date
(a core engineering rule of the project).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from src.utils.config import DATE, PORT_ID


# ---------------------------------------------------------------------------
# Scale-free risk transforms (0..1), all per-row -> no leakage
# ---------------------------------------------------------------------------
def logistic(x: np.ndarray | pd.Series, center: float = 0.0, scale: float = 1.0):
    """Numerically-stable logistic squashing into (0, 1)."""
    z = (np.asarray(x, dtype=float) - center) / max(scale, 1e-9)
    return 1.0 / (1.0 + np.exp(-z))


def looks_standardized(s: pd.Series) -> bool:
    """Heuristic: a z-scored column has negatives and a small spread."""
    s = pd.to_numeric(s, errors="coerce")
    if s.dropna().empty:
        return False
    return (s.min() < -0.01) and (s.std(skipna=True) < 5)


def to_risk(s: pd.Series, center: float, scale: float) -> pd.Series:
    """Map a physical quantity (or a z-scored one) to a 0..1 risk score.

    If the column appears to be standardized (z-scored), we logistic-squash the
    z directly; otherwise we logistic-squash around a physical `center`/`scale`.
    Either way the transform is per-row, so it is leakage-safe.
    """
    s = pd.to_numeric(s, errors="coerce")
    if looks_standardized(s):
        return pd.Series(logistic(s, center=0.0, scale=1.0), index=s.index)
    return pd.Series(logistic(s, center=center, scale=scale), index=s.index)


def minmax01(s: pd.Series) -> pd.Series:
    """Min-max to 0..1 (used only for display-oriented composites)."""
    s = pd.to_numeric(s, errors="coerce")
    lo, hi = s.min(), s.max()
    if not np.isfinite(lo) or not np.isfinite(hi) or hi - lo < 1e-12:
        return pd.Series(np.zeros(len(s)), index=s.index)
    return (s - lo) / (hi - lo)


# ---------------------------------------------------------------------------
# Confidence
# ---------------------------------------------------------------------------
def row_confidence(df: pd.DataFrame, cols, base: float = 1.0) -> pd.Series:
    """Confidence = fraction of required inputs present on each row, * base."""
    present = df[cols].notna().mean(axis=1)
    return (present * base).clip(0, 1).round(3)


# ---------------------------------------------------------------------------
# Backward-looking event decay (used by the news expert)
# ---------------------------------------------------------------------------
def decayed_event_risk(dates: pd.Series, severity: pd.Series,
                       half_life_days: float = 3.0) -> pd.Series:
    """For each day, return the max severity of any *past or current* event,
    decayed exponentially by how long ago it happened. Strictly backward-looking.
    """
    order = np.argsort(dates.values)
    d_sorted = pd.to_datetime(dates.values[order])
    sev_sorted = np.nan_to_num(severity.values[order].astype(float))
    decay = np.log(2) / max(half_life_days, 1e-6)

    out = np.zeros(len(d_sorted))
    last_event_day = None
    last_event_sev = 0.0
    running = 0.0
    for i in range(len(d_sorted)):
        if last_event_day is not None:
            dt = (d_sorted[i] - last_event_day).days
            running = last_event_sev * np.exp(-decay * dt)
        if sev_sorted[i] > running:
            running = sev_sorted[i]
            last_event_day = d_sorted[i]
            last_event_sev = sev_sorted[i]
        out[i] = running

    # restore original order
    res = np.empty(len(out))
    res[order] = out
    return pd.Series(res, index=dates.index)


def sort_key(df: pd.DataFrame) -> pd.DataFrame:
    """Return df sorted by (port_id, date) with date parsed -- a common need."""
    out = df.copy()
    if DATE in out.columns:
        out[DATE] = pd.to_datetime(out[DATE], errors="coerce")
    keys = [c for c in (PORT_ID, DATE) if c in out.columns]
    return out.sort_values(keys).reset_index(drop=True)
