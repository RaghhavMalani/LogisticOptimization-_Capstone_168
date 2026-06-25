"""Decision layer.

Converts the probabilistic forecast table into concrete operational signals:

    congestion_probability  P(congestion_index > threshold) derived from the
                            quantile forecast (a piecewise-linear CDF over the
                            q10/q50/q90 points).
    eta_delay_risk          Low/Medium/High from predicted delay hours.
    port_entry_risk         combines congestion probability + delay.
    operational_adjustment  short rule-based recommendation.
    priority_score          0..1 ranking signal for control-room attention.

Output is one tidy row per (port_id, forecast_origin_date, target_date,
horizon_day) so it joins cleanly to forecasts and feeds the dashboard.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from src.utils.config import PORT_ID
from src.utils.logging_utils import get_logger

log = get_logger(__name__)

# Congestion (0..100) threshold above which a port is "congested".
CONGESTION_THRESHOLD = 50.0


def prob_exceed(q10: float, q50: float, q90: float, threshold: float) -> float:
    """Estimate P(value > threshold) from three quantile points.

    We treat (q10,q50,q90) as points on the CDF at probabilities (0.1,0.5,0.9)
    and linearly interpolate/extrapolate the CDF, clamped to [0,1]. This is a
    simple, defensible way to read a probability off a quantile forecast.
    """
    pts = sorted([(q10, 0.1), (q50, 0.5), (q90, 0.9)])
    xs = [p[0] for p in pts]
    ps = [p[1] for p in pts]
    if threshold <= xs[0]:
        # below lowest quantile -> extrapolate downward
        if xs[1] > xs[0]:
            cdf = ps[0] + (threshold - xs[0]) * (ps[1] - ps[0]) / (xs[1] - xs[0])
        else:
            cdf = ps[0]
    elif threshold >= xs[2]:
        if xs[2] > xs[1]:
            cdf = ps[1] + (threshold - xs[1]) * (ps[2] - ps[1]) / (xs[2] - xs[1])
        else:
            cdf = ps[2]
    else:
        # interpolate within
        if threshold <= xs[1]:
            cdf = ps[0] + (threshold - xs[0]) * (ps[1] - ps[0]) / max(xs[1] - xs[0], 1e-9)
        else:
            cdf = ps[1] + (threshold - xs[1]) * (ps[2] - ps[1]) / max(xs[2] - xs[1], 1e-9)
    cdf = float(np.clip(cdf, 0.0, 1.0))
    return round(1.0 - cdf, 4)


def _delay_risk(delay_hours: float) -> str:
    if np.isnan(delay_hours):
        return "Unknown"
    if delay_hours >= 24:
        return "High"
    if delay_hours >= 12:
        return "Medium"
    return "Low"


def _adjustment(cong_prob: float, entry_risk: str, weather_impact: float) -> str:
    if cong_prob >= 0.6 or entry_risk == "High":
        return ("Add handling shift; stagger arrivals; pre-clear yard space; "
                "notify lines of expected waiting time.")
    if cong_prob >= 0.35:
        return "Monitor; pre-position pilots/tugs; review berth schedule."
    if not np.isnan(weather_impact) and weather_impact >= 0.6:
        return "Weather watch; confirm safe-berthing windows."
    return "Normal operations."


def build_decisions(forecast: pd.DataFrame,
                    weather_now: pd.DataFrame | None = None,
                    threshold: float = CONGESTION_THRESHOLD) -> pd.DataFrame:
    """Build the decision table from the forecast (and optional weather)."""
    if forecast is None or forecast.empty:
        return pd.DataFrame()

    df = forecast.copy()
    # weather impact per port (latest nowcast) for context
    wx = {}
    if weather_now is not None and not weather_now.empty:
        w = weather_now.copy()
        if "horizon_day" in w.columns:
            w = w[w["horizon_day"] == 0]
        w = w.sort_values("date")
        wx = w.groupby(PORT_ID)["WxImpactIndex"].last().to_dict()

    rows = []
    for _, r in df.iterrows():
        cong_prob = prob_exceed(r["q10"], r["q50"], r["q90"], threshold)
        delay = r.get("predicted_delay", np.nan)
        eta_risk = _delay_risk(float(delay) if pd.notna(delay) else np.nan)
        wx_val = wx.get(r[PORT_ID], np.nan)

        # entry risk blends congestion probability and delay risk
        risk_num = 0.6 * cong_prob + 0.4 * {"Low": 0.2, "Medium": 0.6,
                                            "High": 1.0, "Unknown": 0.4}[eta_risk]
        entry_risk = "High" if risk_num >= 0.6 else "Medium" if risk_num >= 0.35 else "Low"

        priority = float(np.clip(
            0.5 * cong_prob + 0.3 * risk_num
            + 0.2 * (wx_val if not np.isnan(wx_val) else 0.0), 0, 1))

        rows.append({
            PORT_ID: r[PORT_ID],
            "forecast_origin_date": r["forecast_origin_date"],
            "target_date": r["target_date"],
            "horizon_day": int(r["horizon_day"]),
            "predicted_congestion": round(float(r["predicted_congestion"]), 2),
            "congestion_probability": cong_prob,
            "eta_delay_risk": eta_risk,
            "port_entry_risk": entry_risk,
            "weather_impact": round(float(wx_val), 3) if not np.isnan(wx_val) else np.nan,
            "operational_adjustment": _adjustment(cong_prob, entry_risk, wx_val),
            "priority_score": round(priority, 4),
        })

    out = pd.DataFrame(rows)
    log.info("Decision layer produced %d rows (%d ports).",
             len(out), out[PORT_ID].nunique())
    return out


def high_risk_calendar(decisions: pd.DataFrame, prob_cut: float = 0.5
                       ) -> pd.DataFrame:
    """Per-port list of high-risk target dates (congestion_probability >= cut)."""
    if decisions.empty:
        return decisions
    hi = decisions[decisions["congestion_probability"] >= prob_cut]
    return (hi.sort_values([PORT_ID, "horizon_day"])
              [[PORT_ID, "target_date", "horizon_day", "congestion_probability",
                "port_entry_risk"]].reset_index(drop=True))
