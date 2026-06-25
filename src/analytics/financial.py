"""Financial / economic analytics (rupee terms).

Transparent first-order estimates (all clearly proxy-calibrated, not audited):
  * port_revenue         : cargo x average tariff -> revenue (INR cr).
  * delay_cost           : expected demurrage from forecast delay hours.
  * value_at_risk        : monthly trade value x congestion probability.
  * scenario_cost        : trade value-at-risk under a shock scenario.

Assumptions (editable constants): tariff ~INR 500/tonne; demurrage ~INR
50,000/vessel/hour; congestion probability read from the q10/q50/q90 forecast.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from src.decision.decision_layer import prob_exceed
from src.utils.config import PORT_BY_ID, PORT_ID

TARIFF_INR_PER_TONNE = 500.0
DEMURRAGE_INR_PER_VESSEL_HOUR = 50_000.0
CONGESTION_THRESHOLD = 50.0
_CR = 1e7  # 1 crore = 10^7


def port_revenue(traffic: pd.DataFrame) -> pd.DataFrame:
    if traffic is None or traffic.empty:
        return pd.DataFrame()
    df = traffic.copy()
    df["date"] = pd.to_datetime(df["date"])
    last = df.sort_values("date").groupby(PORT_ID).tail(1)
    rev = (last["cargo_mt"] * 1e6 * TARIFF_INR_PER_TONNE / _CR).round(1)
    return pd.DataFrame({
        PORT_ID: last[PORT_ID].values,
        "port_name": [PORT_BY_ID[p].name if p in PORT_BY_ID else p for p in last[PORT_ID]],
        "monthly_revenue_inr_cr": rev.values,
    }).sort_values("monthly_revenue_inr_cr", ascending=False).reset_index(drop=True)


def delay_cost(forecast: pd.DataFrame, vessels_per_day: float = 6.0) -> pd.DataFrame:
    """Expected demurrage over the forecast horizon, per port (INR cr)."""
    if forecast is None or forecast.empty or "predicted_delay" not in forecast.columns:
        return pd.DataFrame()
    rows = []
    for pid, g in forecast.groupby(PORT_ID):
        delay_hours = pd.to_numeric(g["predicted_delay"], errors="coerce").fillna(0).sum()
        cost = delay_hours * vessels_per_day * DEMURRAGE_INR_PER_VESSEL_HOUR / _CR
        rows.append({PORT_ID: pid,
                     "port_name": PORT_BY_ID[pid].name if pid in PORT_BY_ID else pid,
                     "horizon_delay_hours": round(float(delay_hours), 1),
                     "expected_demurrage_inr_cr": round(float(cost), 2)})
    return pd.DataFrame(rows).sort_values("expected_demurrage_inr_cr",
                                          ascending=False).reset_index(drop=True)


def value_at_risk(forecast: pd.DataFrame, trade: pd.DataFrame,
                  threshold: float = CONGESTION_THRESHOLD) -> pd.DataFrame:
    """Monthly trade value exposed to congestion = P(congestion>thr) x trade value."""
    if forecast is None or forecast.empty or trade is None or trade.empty:
        return pd.DataFrame()
    tb = (trade.assign(date=pd.to_datetime(trade["date"]))
          .sort_values("date").groupby(PORT_ID).tail(1)
          .set_index(PORT_ID)["trade_value_inr_cr"])
    rows = []
    for pid, g in forecast.groupby(PORT_ID):
        probs = [prob_exceed(r.q10, r.q50, r.q90, threshold) for r in g.itertuples()]
        mean_prob = float(np.mean(probs)) if probs else 0.0
        val = float(tb.get(pid, np.nan))
        rows.append({PORT_ID: pid,
                     "port_name": PORT_BY_ID[pid].name if pid in PORT_BY_ID else pid,
                     "mean_congestion_prob": round(mean_prob, 3),
                     "monthly_trade_value_inr_cr": round(val, 1) if not np.isnan(val) else np.nan,
                     "value_at_risk_inr_cr": round(mean_prob * val, 1)
                     if not np.isnan(val) else np.nan})
    return pd.DataFrame(rows).sort_values("value_at_risk_inr_cr",
                                          ascending=False).reset_index(drop=True)


def scenario_cost(scenario_result, trade: pd.DataFrame) -> dict:
    """Total trade value-at-risk under a shock (uses adjusted congestion + exposure)."""
    if scenario_result is None or trade is None or trade.empty:
        return {}
    var = value_at_risk(scenario_result.adjusted_forecast, trade)
    total = float(var["value_at_risk_inr_cr"].sum()) if not var.empty else 0.0
    return {"scenario": scenario_result.shock.title(),
            "oil_pct": scenario_result.oil_pct,
            "freight_pct": scenario_result.freight_pct,
            "total_value_at_risk_inr_cr": round(total, 1),
            "by_port": var}


def financial_summary(traffic, trade, forecast) -> pd.DataFrame:
    """One row per port combining revenue, demurrage and value-at-risk."""
    rev = port_revenue(traffic)
    dc = delay_cost(forecast)
    var = value_at_risk(forecast, trade)
    out = rev
    for other in (dc, var):
        if not other.empty:
            out = out.merge(other.drop(columns=["port_name"], errors="ignore"),
                            on=PORT_ID, how="left")
    return out
