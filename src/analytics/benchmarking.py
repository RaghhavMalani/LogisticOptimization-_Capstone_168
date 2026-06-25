"""Port benchmarking: league table + composite efficiency score.

Efficiency score (0-100) blends, on the latest month:
  + capacity utilisation        (higher is better)
  + output per ship-berth-day   (higher is better)
  - turnaround days             (lower is better)
  - dwell hours                 (lower is better)
Each component is min-max scaled across ports, so the score is a relative
ranking of operational efficiency (a transparent, explainable proxy for the
kind of DEA frontier a fuller study would use).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from src.utils.config import PORT_BY_ID, PORT_ID


def _latest(traffic: pd.DataFrame) -> pd.DataFrame:
    df = traffic.copy()
    df["date"] = pd.to_datetime(df["date"])
    return df.sort_values("date").groupby(PORT_ID).tail(1).reset_index(drop=True)


def _scale(s: pd.Series, invert: bool = False) -> pd.Series:
    s = pd.to_numeric(s, errors="coerce")
    lo, hi = s.min(), s.max()
    if not np.isfinite(lo) or hi - lo < 1e-9:
        z = pd.Series(np.full(len(s), 0.5), index=s.index)
    else:
        z = (s - lo) / (hi - lo)
    return 1 - z if invert else z


def league_table(traffic: pd.DataFrame) -> pd.DataFrame:
    if traffic is None or traffic.empty:
        return pd.DataFrame()
    df = _latest(traffic)
    comp = pd.DataFrame({PORT_ID: df[PORT_ID]})
    comp["util"] = _scale(df.get("capacity_utilization", 0.5))
    comp["output"] = _scale(df.get("output_per_ship_berth_day", 0))
    comp["turnaround"] = _scale(df.get("turnaround_days", 0), invert=True)
    comp["dwell"] = _scale(df.get("dwell_hours", 0), invert=True)
    score = (0.30 * comp["util"] + 0.25 * comp["output"]
             + 0.25 * comp["turnaround"] + 0.20 * comp["dwell"]) * 100

    out = pd.DataFrame({
        PORT_ID: df[PORT_ID],
        "port_name": [PORT_BY_ID[p].name if p in PORT_BY_ID else p for p in df[PORT_ID]],
        "region": [PORT_BY_ID[p].region if p in PORT_BY_ID else "" for p in df[PORT_ID]],
        "cargo_mt": df.get("cargo_mt"),
        "containers_teu": df.get("containers_teu"),
        "capacity_utilization": df.get("capacity_utilization"),
        "turnaround_days": df.get("turnaround_days"),
        "efficiency_score": score.round(1),
    })
    out["throughput_rank"] = out["cargo_mt"].rank(ascending=False).astype("Int64")
    out["efficiency_rank"] = out["efficiency_score"].rank(ascending=False).astype("Int64")
    out["efficiency_pctile"] = (out["efficiency_score"].rank(pct=True) * 100).round(0)
    return out.sort_values("efficiency_score", ascending=False).reset_index(drop=True)


def coast_comparison(traffic: pd.DataFrame) -> pd.DataFrame:
    lt = league_table(traffic)
    if lt.empty:
        return lt
    return (lt.groupby("region")
              .agg(ports=("port_id", "count"),
                   total_cargo_mt=("cargo_mt", "sum"),
                   mean_efficiency=("efficiency_score", "mean"),
                   mean_turnaround_days=("turnaround_days", "mean"))
              .round(2).reset_index().sort_values("total_cargo_mt", ascending=False))
