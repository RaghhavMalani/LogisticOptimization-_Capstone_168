"""Macro / conditions expert -- turns current economic conditions into stress
features that the HSMM uses to infer the operational regime.

This is what makes the regime model *dynamic and condition-driven*: instead of
keying only off operational signals (queues, weather), the HSMM now also reacts
to oil prices, the rupee, inflation, and the live news/event stream. A spike in
Brent + a weaker INR + a Red Sea event pushes the latent state toward CONGESTED/
SEVERE even before queues build.

Output (daily, national -> broadcast across ports by date):
    date, oil_stress, fx_stress, inflation_stress, news_stress, macro_pressure
All scores are 0..1. Stress transforms use an *expanding* (backward-only) z-score
so a feature for a past date never uses future values.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from src.experts.base import logistic
from src.utils.logging_utils import get_logger

log = get_logger(__name__)

_OUT = ["date", "oil_stress", "fx_stress", "inflation_stress", "news_stress",
        "macro_pressure"]


def _expanding_stress(s: pd.Series, sign: float = 1.0) -> pd.Series:
    """Logistic of a backward-only z-score (sign=+1: higher value = more stress)."""
    s = pd.to_numeric(s, errors="coerce")
    mean = s.expanding(min_periods=5).mean()
    std = s.expanding(min_periods=5).std().replace(0, np.nan)
    z = ((s - mean) / std).fillna(0.0) * sign
    return pd.Series(logistic(z, center=0.0, scale=1.0), index=s.index)


def _news_stress(macro_dates: pd.Series, events: pd.DataFrame) -> pd.Series:
    """Daily news stress = decayed sum of recent event severity (0..1)."""
    out = pd.Series(0.0, index=macro_dates.index)
    if events is None or events.empty or "date" not in events.columns:
        return out
    ev = events.copy()
    # GDELT dates are tz-aware (UTC); coerce to tz-naive so they compare with
    # the (naive) macro dates without raising.
    ev["date"] = pd.to_datetime(ev["date"], errors="coerce", utc=True).dt.tz_localize(None)
    ev = ev.dropna(subset=["date"])
    md = pd.to_datetime(macro_dates)
    if getattr(md.dtype, "tz", None) is not None:
        md = md.dt.tz_localize(None)
    vals = []
    for d in md:
        recent = ev[(ev["date"] <= d) & (ev["date"] >= d - pd.Timedelta(days=14))]
        if recent.empty:
            vals.append(0.0)
            continue
        age = (d - recent["date"]).dt.days.clip(lower=0)
        decay = np.exp(-age / 7.0)
        score = float((pd.to_numeric(recent["severity"], errors="coerce").fillna(0)
                       * decay).sum())
        vals.append(min(1.0, score / 2.0))
    return pd.Series(vals, index=macro_dates.index)


def run(macro: pd.DataFrame, events: pd.DataFrame | None = None) -> pd.DataFrame:
    if macro is None or macro.empty:
        log.warning("macro_expert: empty macro frame.")
        return pd.DataFrame(columns=_OUT)
    df = macro.sort_values("date").reset_index(drop=True).copy()

    df["oil_stress"] = _expanding_stress(df.get("brent_usd"), sign=1.0)
    df["fx_stress"] = _expanding_stress(df.get("usd_inr"), sign=1.0)  # weaker INR = stress
    if "inflation_yoy" in df.columns:
        # absolute mapping: ~4% neutral, ~8% high
        df["inflation_stress"] = logistic(df["inflation_yoy"], center=5.0, scale=1.5)
    else:
        df["inflation_stress"] = 0.5
    df["news_stress"] = _news_stress(df["date"], events)

    df["macro_pressure"] = np.clip(
        0.30 * df["oil_stress"] + 0.20 * df["fx_stress"]
        + 0.25 * df["inflation_stress"] + 0.25 * df["news_stress"], 0, 1)

    for c in ["oil_stress", "fx_stress", "inflation_stress", "news_stress",
              "macro_pressure"]:
        df[c] = df[c].astype(float).round(4)
    log.info("macro_expert: %d days; latest macro_pressure=%.2f",
             len(df), float(df["macro_pressure"].iloc[-1]))
    return df[_OUT]
