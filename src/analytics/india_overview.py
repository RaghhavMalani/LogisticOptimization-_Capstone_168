"""India-wide ("business") analytics: national aggregates and concentration.

Gives the top-of-funnel view a management/Bloomberg-style screen wants:
national throughput + growth, coast split, top ports, commodity composition,
and a concentration (HHI) measure of how reliant India is on its busiest ports.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from src.utils.config import PORT_BY_ID, PORT_ID
from src.analytics.cargo import national_commodity_mix


def national_summary(traffic: pd.DataFrame) -> dict:
    if traffic is None or traffic.empty:
        return {}
    df = traffic.copy()
    df["date"] = pd.to_datetime(df["date"])
    last = df["date"].max()
    prev = last - pd.DateOffset(months=12)
    cur = df[df["date"] == last]
    yoy = df[df["date"] == prev]

    total_cargo = float(cur["cargo_mt"].sum())
    total_teu = float(cur["containers_teu"].sum()) if "containers_teu" in cur else float("nan")
    yoy_growth = (total_cargo / float(yoy["cargo_mt"].sum()) - 1) * 100 \
        if not yoy.empty and yoy["cargo_mt"].sum() else float("nan")

    # HHI concentration on port shares (0-1; higher = more concentrated)
    shares = cur.groupby(PORT_ID)["cargo_mt"].sum()
    hhi = float(((shares / shares.sum()) ** 2).sum())

    return {
        "as_of": str(last.date()),
        "n_ports": int(cur[PORT_ID].nunique()),
        "monthly_cargo_mt": round(total_cargo, 1),
        "annualised_cargo_mt": round(total_cargo * 12, 1),
        "monthly_teu": round(total_teu, 0),
        "cargo_yoy_pct": round(yoy_growth, 2),
        "port_concentration_hhi": round(hhi, 3),
    }


def top_ports(traffic: pd.DataFrame, n: int = 5) -> pd.DataFrame:
    if traffic is None or traffic.empty:
        return pd.DataFrame()
    df = traffic.copy()
    df["date"] = pd.to_datetime(df["date"])
    cur = df[df["date"] == df["date"].max()]
    out = (cur.groupby(PORT_ID)["cargo_mt"].sum().sort_values(ascending=False)
           .head(n).reset_index())
    out["port_name"] = [PORT_BY_ID[p].name if p in PORT_BY_ID else p for p in out[PORT_ID]]
    out["share_pct"] = (out["cargo_mt"] / cur["cargo_mt"].sum() * 100).round(1)
    return out


def coast_split(traffic: pd.DataFrame) -> pd.DataFrame:
    if traffic is None or traffic.empty:
        return pd.DataFrame()
    df = traffic.copy()
    df["date"] = pd.to_datetime(df["date"])
    cur = df[df["date"] == df["date"].max()].copy()
    cur["region"] = [PORT_BY_ID[p].region if p in PORT_BY_ID else "?" for p in cur[PORT_ID]]
    out = cur.groupby("region")["cargo_mt"].sum().reset_index()
    out["share_pct"] = (out["cargo_mt"] / out["cargo_mt"].sum() * 100).round(1)
    return out.sort_values("cargo_mt", ascending=False).reset_index(drop=True)


def commodity_overview(commodity: pd.DataFrame) -> pd.DataFrame:
    return national_commodity_mix(commodity)
