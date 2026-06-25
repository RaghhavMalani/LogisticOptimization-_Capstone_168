"""Translate model output into decisions for two audiences.

Port managers care about port operations (congestion, delay, throughput,
regime, capacity, weather, events). Ship managers care about a single vessel's
ETA / berth-waiting / entry risk and the best arrival window.

This module is pure pandas (no UI dependency) so it can run inside run_demo.py
and be imported by the optional Streamlit app. It produces both structured
tables (for CSV) and short natural-language briefings (for humans).
"""

from __future__ import annotations

from typing import Dict, List

import numpy as np
import pandas as pd

from src.utils.config import DATE, PORT_BY_ID, PORT_ID
from src.utils.logging_utils import get_logger

log = get_logger(__name__)

_HIGH = "High"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _latest_regime(regimes: pd.DataFrame) -> pd.DataFrame:
    r = regimes.copy()
    r[DATE] = pd.to_datetime(r[DATE])
    idx = r.groupby(PORT_ID)[DATE].idxmax()
    return r.loc[idx].reset_index(drop=True)


def _weather_now_by_port(weather_now: pd.DataFrame | None) -> Dict[str, float]:
    if weather_now is None or weather_now.empty:
        return {}
    w = weather_now.copy()
    if "horizon_day" in w.columns:
        w = w[w["horizon_day"] == 0]
    w[DATE] = pd.to_datetime(w[DATE])
    idx = w.groupby(PORT_ID)[DATE].idxmax()
    latest = w.loc[idx]
    return dict(zip(latest[PORT_ID], latest["WxImpactIndex"]))


def _bucket(x: float, lo: float, hi: float) -> str:
    if x >= hi:
        return _HIGH
    if x >= lo:
        return "Moderate"
    return "Low"


# ---------------------------------------------------------------------------
# Port manager
# ---------------------------------------------------------------------------
def build_port_manager_report(forecast: pd.DataFrame, regimes: pd.DataFrame,
                              weather_now: pd.DataFrame | None = None
                              ) -> Dict[str, object]:
    latest = _latest_regime(regimes).set_index(PORT_ID)
    wx = _weather_now_by_port(weather_now)

    rows: List[Dict] = []
    messages: Dict[str, str] = {}

    for pid, g in forecast.groupby(PORT_ID, sort=False):
        g = g.sort_values("horizon_day")
        port = PORT_BY_ID.get(pid)
        name = port.name if port else pid

        peak = g.loc[g["predicted_congestion"].idxmax()]
        peak_delay = g.loc[g["predicted_delay"].idxmax()] if g["predicted_delay"].notna().any() else peak
        high_risk_days = g.loc[g["risk_level"] == _HIGH, "horizon_day"].tolist()
        mean_throughput = float(g["predicted_throughput"].mean()) \
            if g["predicted_throughput"].notna().any() else float("nan")

        reg = latest.loc[pid] if pid in latest.index else None
        regime_label = reg["regime_label"] if reg is not None else "UNKNOWN"
        exp_remaining = float(reg["expected_remaining_days"]) if reg is not None else float("nan")
        days_in_state = int(reg["days_in_state"]) if reg is not None else 0
        trans_risk = float(reg["transition_risk"]) if reg is not None else 0.0

        wx_val = wx.get(pid, np.nan)
        wx_label = _bucket(wx_val, 0.3, 0.6) if not np.isnan(wx_val) else "Unknown"
        cap = port.port_capacity if port else 1.0
        capacity_risk = _bucket(peak["predicted_congestion"] / 100.0 / max(cap, 0.4),
                                0.5, 0.8)

        rows.append({
            PORT_ID: pid, "port_name": name,
            "current_regime": regime_label,
            "days_in_state": days_in_state,
            "expected_remaining_days": round(exp_remaining, 1),
            "transition_risk": round(trans_risk, 3),
            "peak_congestion_day": int(peak["horizon_day"]),
            "peak_congestion_q50": round(float(peak["q50"]), 1),
            "peak_congestion_q90": round(float(peak["q90"]), 1),
            "peak_delay_hours": round(float(peak_delay["predicted_delay"]), 1)
            if not np.isnan(peak_delay["predicted_delay"]) else np.nan,
            "mean_throughput": round(mean_throughput, 1),
            "weather_impact": wx_label,
            "capacity_risk": capacity_risk,
            "high_risk_horizon_days": ",".join(map(str, high_risk_days)) or "none",
            "recommended_action": _port_action(regime_label, capacity_risk,
                                                high_risk_days, wx_label),
        })

        messages[pid] = _port_message(name, regime_label, exp_remaining,
                                      high_risk_days, peak, wx_label, capacity_risk)

    table = pd.DataFrame(rows)
    return {"table": table, "messages": messages}


def _port_action(regime: str, capacity_risk: str, high_days: List[int],
                 wx_label: str) -> str:
    if regime == "SEVERE" or capacity_risk == _HIGH:
        return ("Activate congestion protocol: prioritise berth allocation, "
                "stagger arrivals, add yard/handling shifts.")
    if regime == "CONGESTED" or high_days:
        return ("Monitor closely; pre-position resources for high-risk days and "
                "advise lines of possible waiting time.")
    if wx_label == _HIGH:
        return "Prepare for weather disruption; review safe-berthing plans."
    return "Normal operations; maintain standard staffing."


def _port_message(name, regime, exp_remaining, high_days, peak, wx_label,
                  capacity_risk) -> str:
    parts = [f"{name} is expected to remain in {regime} state for "
             f"~{exp_remaining:.0f} day(s)."]
    if high_days:
        parts.append(f"P90 delay/congestion risk exceeds threshold on "
                     f"Day +{min(high_days)}.")
    parts.append(f"Weather impact is {wx_label.lower()}; "
                 f"capacity risk is {capacity_risk.lower()} "
                 f"(peak congestion ~{peak['q50']:.0f}, P90 ~{peak['q90']:.0f}).")
    return " ".join(parts)


# ---------------------------------------------------------------------------
# Ship manager
# ---------------------------------------------------------------------------
def build_ship_manager_report(forecast: pd.DataFrame, regimes: pd.DataFrame,
                              weather_now: pd.DataFrame | None = None,
                              window_days: int = 5) -> Dict[str, object]:
    wx = _weather_now_by_port(weather_now)
    rows: List[Dict] = []
    messages: Dict[str, str] = {}

    for pid, g in forecast.groupby(PORT_ID, sort=False):
        g = g.sort_values("horizon_day")
        w = g[g["horizon_day"] <= window_days]
        if w.empty:
            w = g
        port = PORT_BY_ID.get(pid)
        name = port.name if port else pid

        # Berth waiting risk ~ congestion; entry risk ~ delay; ETA risk ~ both.
        berth_risk = _bucket(w["q50"].max(), 40, 60)
        delay_series = w["predicted_delay"] if w["predicted_delay"].notna().any() else w["q50"]
        entry_risk = _bucket(delay_series.max(), 12, 24)
        best = w.loc[delay_series.idxmin()]
        worst = w.loc[delay_series.idxmax()]
        buffer_hours = int(np.clip(delay_series.max() * 0.6, 4, 48))
        conf = float(w["confidence_score"].mean())
        conf_label = _bucket(conf, 0.4, 0.7)
        # confidence is "good" when high -> invert bucket wording
        conf_label = {"Low": "low", "Moderate": "medium", _HIGH: "high"}[conf_label]
        wx_val = wx.get(pid, np.nan)
        wx_label = _bucket(wx_val, 0.3, 0.6) if not np.isnan(wx_val) else "Unknown"

        rows.append({
            PORT_ID: pid, "port_name": name,
            "eta_delay_risk": _bucket(delay_series.max(), 12, 24),
            "berth_waiting_risk": berth_risk,
            "port_entry_risk": entry_risk,
            "best_arrival_day": int(best["horizon_day"]),
            "worst_arrival_day": int(worst["horizon_day"]),
            "recommended_buffer_hours": buffer_hours,
            "weather_hazard_risk": wx_label,
            "confidence": conf_label,
            "advisory": _ship_advisory(berth_risk, entry_risk, wx_label, conf_label),
        })
        messages[pid] = _ship_message(name, berth_risk, buffer_hours, conf_label,
                                      window_days)

    return {"table": pd.DataFrame(rows), "messages": messages}


def _ship_advisory(berth_risk, entry_risk, wx_label, conf_label) -> str:
    if berth_risk == _HIGH or entry_risk == _HIGH:
        return ("Consider re-timing arrival to a lower-risk day or evaluating an "
                "alternative port; add schedule buffer.")
    if wx_label == _HIGH:
        return "Weather hazard elevated; confirm pilotage/berthing windows."
    return "Conditions favourable; proceed with standard buffer."


def _ship_message(name, berth_risk, buffer_hours, conf_label, window_days) -> str:
    return (f"For vessels arriving at {name} in the next {window_days} days, "
            f"berth waiting risk is {berth_risk.lower()}. "
            f"Recommended buffer: {buffer_hours - 6}-{buffer_hours} hours. "
            f"Confidence: {conf_label}.")


# ---------------------------------------------------------------------------
def render_text_briefing(port_report: Dict, ship_report: Dict) -> str:
    """A compact multi-port text briefing for the console / a .txt artifact."""
    lines = ["=" * 70, "PORT MANAGER BRIEFING", "=" * 70]
    for pid, msg in port_report["messages"].items():
        lines.append(f"[{pid}] {msg}")
    lines += ["", "=" * 70, "SHIP MANAGER BRIEFING", "=" * 70]
    for pid, msg in ship_report["messages"].items():
        lines.append(f"[{pid}] {msg}")
    return "\n".join(lines)
