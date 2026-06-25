"""Operational KPIs + trends.

Per-port latest KPIs (cargo, TEU, utilisation, turnaround, dwell, output per
ship-berth-day), plus month-on-month and year-on-year growth and a simple
seasonality strength. Pure pandas.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from src.utils.config import PORT_BY_ID, PORT_ID

_KPI_COLS = ["cargo_mt", "containers_teu", "capacity_utilization",
             "turnaround_days", "dwell_hours", "output_per_ship_berth_day"]


def _growth(series: pd.Series, periods: int) -> float:
    s = series.dropna()
    if len(s) <= periods or s.iloc[-1 - periods] == 0:
        return float("nan")
    return round((s.iloc[-1] / s.iloc[-1 - periods] - 1) * 100, 2)


def port_kpis(traffic: pd.DataFrame) -> pd.DataFrame:
    """Latest KPIs + MoM/YoY growth per port."""
    if traffic is None or traffic.empty:
        return pd.DataFrame()
    df = traffic.copy()
    df["date"] = pd.to_datetime(df["date"])
    rows = []
    for pid, g in df.sort_values("date").groupby(PORT_ID):
        last = g.iloc[-1]
        row = {PORT_ID: pid,
               "port_name": PORT_BY_ID[pid].name if pid in PORT_BY_ID else pid,
               "region": PORT_BY_ID[pid].region if pid in PORT_BY_ID else "",
               "as_of": str(pd.to_datetime(last["date"]).date())}
        for c in _KPI_COLS:
            if c in g.columns:
                row[c] = round(float(last[c]), 2)
        row["cargo_mom_pct"] = _growth(g["cargo_mt"], 1) if "cargo_mt" in g else np.nan
        row["cargo_yoy_pct"] = _growth(g["cargo_mt"], 12) if "cargo_mt" in g else np.nan
        if "containers_teu" in g:
            row["teu_yoy_pct"] = _growth(g["containers_teu"], 12)
        rows.append(row)
    return pd.DataFrame(rows).sort_values("cargo_mt", ascending=False).reset_index(drop=True)


def seasonality_strength(traffic: pd.DataFrame, col: str = "cargo_mt") -> pd.DataFrame:
    """Crude seasonality strength = std of monthly means / overall mean, per port."""
    if traffic is None or traffic.empty or col not in traffic.columns:
        return pd.DataFrame()
    df = traffic.copy()
    df["date"] = pd.to_datetime(df["date"])
    df["m"] = df["date"].dt.month
    rows = []
    for pid, g in df.groupby(PORT_ID):
        monthly = g.groupby("m")[col].mean()
        strength = float(monthly.std() / monthly.mean()) if monthly.mean() else 0.0
        peak_month = int(monthly.idxmax()) if not monthly.empty else 0
        rows.append({PORT_ID: pid, "seasonality_strength": round(strength, 3),
                     "peak_month": peak_month})
    return pd.DataFrame(rows)


def trend_table(traffic: pd.DataFrame, col: str = "cargo_mt") -> pd.DataFrame:
    """Long format (port_id, date, value) for plotting trends."""
    if traffic is None or traffic.empty or col not in traffic.columns:
        return pd.DataFrame()
    out = traffic[[PORT_ID, "date", col]].copy()
    out["date"] = pd.to_datetime(out["date"])
    return out.sort_values([PORT_ID, "date"]).reset_index(drop=True)
