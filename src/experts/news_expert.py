"""News / Geopolitical Expert Module.

Turns raw news / event signals into numerical external-shock features.

Output columns (per the project spec)
-------------------------------------
    port_id, date,
    news_sentiment_score,   # 0..1, higher = more negative/risky tone
    geo_risk_score,         # 0..1 composite geopolitical risk
    strike_risk,            # 0..1
    policy_risk,            # 0..1
    conflict_risk,          # 0..1
    event_spike_score,      # 0..1, abnormal burst of event severity
    news_confidence         # 0..1

Inputs accepted (any subset): sentiment, event_type, event_severity.
If only `sentiment` is present (e.g. the shipped national news CSV), the event
risks default to 0 and confidence is reduced.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from src.utils.config import DATE, PORT_ID
from src.experts.base import decayed_event_risk, logistic, sort_key
from src.utils.logging_utils import get_logger

log = get_logger(__name__)

# Which event_type strings map to which risk channel.
_EVENT_MAP = {
    "strike": "strike_risk",
    "labour": "strike_risk",
    "policy": "policy_risk",
    "regulation": "policy_risk",
    "tariff": "policy_risk",
    "conflict": "conflict_risk",
    "war": "conflict_risk",
    "attack": "conflict_risk",
}

_OUT_COLS = [PORT_ID, DATE, "news_sentiment_score", "geo_risk_score",
             "strike_risk", "policy_risk", "conflict_risk",
             "event_spike_score", "news_confidence"]


def _per_port(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()

    # Sentiment -> risk score in 0..1. Negative sentiment => higher risk.
    if "sentiment" in out:
        # logistic(-sentiment): for z-scored or raw, more negative => closer to 1
        out["news_sentiment_score"] = logistic(-out["sentiment"].fillna(0),
                                                center=0.0, scale=1.0)
    else:
        out["news_sentiment_score"] = 0.5  # neutral prior

    # Per-channel decayed event risk (strictly backward-looking).
    has_events = ("event_type" in out) and ("event_severity" in out)
    for channel in ["strike_risk", "policy_risk", "conflict_risk"]:
        out[channel] = 0.0
    if has_events:
        et = out["event_type"].astype(str).str.lower()
        sev = pd.to_numeric(out["event_severity"], errors="coerce").fillna(0.0)
        for raw_type, channel in _EVENT_MAP.items():
            mask = et.eq(raw_type)
            if mask.any():
                chan_sev = sev.where(mask, 0.0)
                out[channel] = np.maximum(
                    out[channel],
                    decayed_event_risk(out[DATE], chan_sev, half_life_days=3.0))

        # Event spike: rolling backward z-score of total severity, squashed.
        roll_mean = sev.rolling(14, min_periods=3).mean()
        roll_std = sev.rolling(14, min_periods=3).std().replace(0, np.nan)
        spike_z = ((sev - roll_mean) / roll_std).fillna(0.0)
        out["event_spike_score"] = logistic(spike_z, center=1.0, scale=1.0)
    else:
        out["event_spike_score"] = 0.0

    # Composite geopolitical risk.
    out["geo_risk_score"] = np.clip(
        0.35 * out["news_sentiment_score"]
        + 0.20 * out["strike_risk"]
        + 0.20 * out["policy_risk"]
        + 0.15 * out["conflict_risk"]
        + 0.10 * out["event_spike_score"], 0, 1)

    # Confidence: full when we have events, reduced when only sentiment.
    out["news_confidence"] = 0.9 if has_events else 0.6
    return out


def run(news_raw: pd.DataFrame) -> pd.DataFrame:
    if news_raw is None or news_raw.empty:
        log.warning("news_raw is empty; news expert returns empty frame.")
        return pd.DataFrame(columns=_OUT_COLS)

    df = sort_key(news_raw)
    parts = []
    for pid, g in df.groupby(PORT_ID, sort=False):
        parts.append(_per_port(g))
    out = pd.concat(parts, ignore_index=True)

    round_cols = ["news_sentiment_score", "geo_risk_score", "strike_risk",
                  "policy_risk", "conflict_risk", "event_spike_score",
                  "news_confidence"]
    out[round_cols] = out[round_cols].astype(float).round(4)
    return out[_OUT_COLS]
