"""Demand / trade-pressure analytics.

  * demand_index_by_port : composite demand pressure per port from throughput
                           growth, utilisation and import intensity (0-100).
  * trade_balance        : import/export tonnes + balance + value per port.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from src.utils.config import PORT_BY_ID, PORT_ID


def trade_balance(trade: pd.DataFrame) -> pd.DataFrame:
    if trade is None or trade.empty:
        return pd.DataFrame()
    df = trade.copy()
    df["date"] = pd.to_datetime(df["date"])
    last = df.sort_values("date").groupby(PORT_ID).tail(1)
    out = last[[PORT_ID, "import_mt", "export_mt", "trade_value_inr_cr"]].copy()
    out["net_balance_mt"] = (out["export_mt"] - out["import_mt"]).round(3)
    out["import_share"] = (out["import_mt"] /
                           (out["import_mt"] + out["export_mt"]).clip(lower=1e-9)).round(3)
    out["port_name"] = [PORT_BY_ID[p].name if p in PORT_BY_ID else p for p in out[PORT_ID]]
    return out.sort_values("trade_value_inr_cr", ascending=False).reset_index(drop=True)


def demand_index_by_port(traffic: pd.DataFrame, trade: pd.DataFrame) -> pd.DataFrame:
    if traffic is None or traffic.empty:
        return pd.DataFrame()
    t = traffic.copy()
    t["date"] = pd.to_datetime(t["date"])
    rows = []
    for pid, g in t.sort_values("date").groupby(PORT_ID):
        s = pd.to_numeric(g["cargo_mt"], errors="coerce")
        growth = (s.iloc[-1] / s.iloc[-13] - 1) if len(s) > 13 and s.iloc[-13] else 0.0
        util = float(g["capacity_utilization"].iloc[-1]) if "capacity_utilization" in g else 0.6
        rows.append({PORT_ID: pid, "yoy_growth": growth, "utilization": util})
    d = pd.DataFrame(rows)

    imp_share = pd.Series(0.5, index=d.index)
    if trade is not None and not trade.empty:
        tb = trade_balance(trade).set_index(PORT_ID)["import_share"]
        imp_share = d[PORT_ID].map(tb).fillna(0.5)

    g = d["yoy_growth"].clip(-0.3, 0.5)
    g01 = (g - g.min()) / (g.max() - g.min() + 1e-9)
    d["demand_index"] = (100 * (0.45 * g01 + 0.35 * d["utilization"]
                                + 0.20 * imp_share.values)).round(1)
    d["yoy_growth_pct"] = (d["yoy_growth"] * 100).round(2)
    d["port_name"] = [PORT_BY_ID[p].name if p in PORT_BY_ID else p for p in d[PORT_ID]]
    return d[[PORT_ID, "port_name", "demand_index", "yoy_growth_pct",
              "utilization"]].sort_values("demand_index", ascending=False).reset_index(drop=True)
