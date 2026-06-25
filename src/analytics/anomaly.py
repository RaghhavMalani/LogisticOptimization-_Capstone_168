"""Anomaly detection / early warning on port time series.

Per-port rolling z-score: a month is flagged when a metric deviates more than
`z_thresh` from its trailing mean. Backward-looking only (no leakage), so it
doubles as an early-warning signal.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from src.utils.config import PORT_ID


def detect_anomalies(df: pd.DataFrame, col: str = "cargo_mt",
                     window: int = 6, z_thresh: float = 2.0) -> pd.DataFrame:
    if df is None or df.empty or col not in df.columns:
        return pd.DataFrame()
    d = df.copy()
    d["date"] = pd.to_datetime(d["date"])
    out = []
    for pid, g in d.sort_values("date").groupby(PORT_ID):
        s = pd.to_numeric(g[col], errors="coerce")
        mean = s.rolling(window, min_periods=3).mean().shift(1)
        std = s.rolling(window, min_periods=3).std().shift(1).replace(0, np.nan)
        z = (s - mean) / std
        g = g.assign(metric=col, value=s, zscore=z.round(2),
                     is_anomaly=(z.abs() >= z_thresh))
        out.append(g[g["is_anomaly"] == True][[PORT_ID, "date", "metric",
                                               "value", "zscore"]])
    res = pd.concat(out, ignore_index=True) if out else pd.DataFrame()
    return res.sort_values("date").reset_index(drop=True) if not res.empty else res
