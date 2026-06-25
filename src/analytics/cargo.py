"""Cargo & commodity-mix analytics.

  * commodity_mix_by_port : share of each commodity group per port (latest).
  * national_commodity_mix : India-wide commodity composition + YoY growth.
  * cargo_type_split       : containerised vs bulk vs liquid split per port.
"""

from __future__ import annotations

import pandas as pd

from src.utils.config import PORT_ID

_LIQUID = {"pol_crude"}
_CONTAINER = {"containers"}


def _latest_month(commodity: pd.DataFrame) -> pd.Timestamp:
    return pd.to_datetime(commodity["date"]).max()


def commodity_mix_by_port(commodity: pd.DataFrame) -> pd.DataFrame:
    if commodity is None or commodity.empty:
        return pd.DataFrame()
    df = commodity.copy()
    df["date"] = pd.to_datetime(df["date"])
    last = df[df["date"] == _latest_month(df)]
    pivot = last.pivot_table(index=PORT_ID, columns="commodity",
                             values="cargo_mt", aggfunc="sum").fillna(0)
    shares = pivot.div(pivot.sum(axis=1), axis=0).round(3)
    shares.columns = [f"share_{c}" for c in shares.columns]
    return shares.reset_index()


def national_commodity_mix(commodity: pd.DataFrame) -> pd.DataFrame:
    if commodity is None or commodity.empty:
        return pd.DataFrame()
    df = commodity.copy()
    df["date"] = pd.to_datetime(df["date"])
    last = _latest_month(df)
    prev = last - pd.DateOffset(months=12)
    cur = df[df["date"] == last].groupby("commodity")["cargo_mt"].sum()
    yoy = df[df["date"] == prev].groupby("commodity")["cargo_mt"].sum()
    out = pd.DataFrame({"commodity": cur.index, "cargo_mt": cur.values.round(2)})
    out["share_pct"] = (cur / cur.sum() * 100).round(1).values
    out["yoy_pct"] = [round((cur.get(c, 0) / yoy.get(c, float("nan")) - 1) * 100, 1)
                      if yoy.get(c) else float("nan") for c in cur.index]
    return out.sort_values("cargo_mt", ascending=False).reset_index(drop=True)


def cargo_type_split(commodity: pd.DataFrame) -> pd.DataFrame:
    if commodity is None or commodity.empty:
        return pd.DataFrame()
    df = commodity.copy()
    df["date"] = pd.to_datetime(df["date"])
    last = df[df["date"] == _latest_month(df)]
    def kind(c):
        if c in _CONTAINER:
            return "containerised"
        if c in _LIQUID:
            return "liquid_bulk"
        return "dry_bulk"
    last = last.assign(cargo_type=last["commodity"].map(kind))
    piv = last.pivot_table(index=PORT_ID, columns="cargo_type",
                           values="cargo_mt", aggfunc="sum").fillna(0)
    piv = piv.div(piv.sum(axis=1), axis=0).round(3)
    return piv.reset_index()
