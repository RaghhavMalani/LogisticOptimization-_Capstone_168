"""Trade / Demand Expert Module.

Converts coarse monthly/quarterly trade & macro data into a *daily* port-level
demand-pressure signal, using time-aware resampling that respects how each kind
of quantity behaves and that avoids look-ahead leakage.

Resampling rules
----------------
  * demand_index (a smooth index)        -> linear interpolation between months
  * macro_iip    (a slowly-changing
                  *condition*)            -> forward-fill
  * trade_volume (a monthly *total*)      -> distributed evenly across the days
                                             of its month (daily = total / ndays)

Leakage control
---------------
Official monthly statistics are published with a lag. We therefore assume a
month's value only becomes "known" `publication_lag_months` after the month
starts (default 1). A value is never applied to a date before it would have been
available.

Output columns (per the project spec)
-------------------------------------
    port_id, date, demand_index, demand_pressure, trade_trend, demand_confidence
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from src.utils.config import DATE, PORT_ID
from src.experts.base import minmax01
from src.utils.logging_utils import get_logger

log = get_logger(__name__)

_OUT_COLS = [PORT_ID, DATE, "demand_index", "demand_pressure", "trade_trend",
             "demand_confidence"]


def _expand_one_port(monthly: pd.DataFrame, daily_dates: pd.DatetimeIndex,
                     publication_lag_months: int) -> pd.DataFrame:
    monthly = monthly.copy()
    monthly["month_start"] = pd.to_datetime(
        dict(year=monthly["year"].astype(int),
             month=monthly["month"].astype(int), day=1))
    # The date from which this month's figures are considered known.
    monthly["available_from"] = monthly["month_start"] + pd.DateOffset(
        months=publication_lag_months)
    monthly = monthly.sort_values("month_start")

    daily = pd.DataFrame({DATE: daily_dates})
    daily["days_in_month"] = daily[DATE].dt.daysinmonth

    has_volume = "trade_volume" in monthly.columns
    has_demand = "demand_index" in monthly.columns
    has_macro = "macro_iip" in monthly.columns

    # --- forward-fill on availability date (leakage-safe) --------------------
    # Build a step series: as of each daily date, take the most recent month
    # whose `available_from` <= date.
    avail = monthly[["available_from"]].copy()
    avail["idx"] = np.arange(len(monthly))
    merged = pd.merge_asof(daily.sort_values(DATE), avail.sort_values("available_from"),
                           left_on=DATE, right_on="available_from", direction="backward")
    merged["idx"] = merged["idx"].astype("Int64")

    def gather(col):
        vals = monthly[col].to_numpy()
        return merged["idx"].map(lambda i: vals[int(i)] if pd.notna(i) else np.nan)

    out = pd.DataFrame({DATE: merged[DATE]})

    # demand_index: forward-fill the known monthly value then interpolate the
    # smooth transitions between known months.
    if has_demand:
        out["demand_index"] = pd.to_numeric(gather("demand_index"), errors="coerce")
        out["demand_index"] = out["demand_index"].interpolate(
            method="linear", limit_direction="both")
    else:
        out["demand_index"] = np.nan

    # macro: forward-fill (condition), no interpolation.
    out["_macro"] = pd.to_numeric(gather("macro_iip"), errors="coerce") if has_macro else np.nan
    out["_macro"] = out["_macro"].ffill().bfill()

    # trade_volume: distribute the monthly total across days of the month.
    if has_volume:
        monthly_total = pd.to_numeric(gather("trade_volume"), errors="coerce")
        out["_daily_volume"] = monthly_total / merged["days_in_month"].to_numpy()
    else:
        out["_daily_volume"] = np.nan

    # --- demand_pressure: blend of demand level + macro + flow, scaled 0..1 ---
    components = []
    if has_demand:
        components.append(minmax01(out["demand_index"]))
    if has_macro:
        components.append(minmax01(out["_macro"]))
    if has_volume:
        components.append(minmax01(out["_daily_volume"]))
    if components:
        out["demand_pressure"] = np.clip(np.mean(np.vstack(
            [c.to_numpy() for c in components]), axis=0), 0, 1)
    else:
        out["demand_pressure"] = 0.5

    # --- trade_trend: backward 30-day change in demand_pressure (-1..1) -------
    out["trade_trend"] = (out["demand_pressure"]
                          - out["demand_pressure"].shift(30)).fillna(0.0)
    out["trade_trend"] = np.tanh(out["trade_trend"] * 5).round(4)

    # --- confidence: how many of the three inputs were available -------------
    n_inputs = sum([has_demand, has_macro, has_volume])
    out["demand_confidence"] = round(0.5 + 0.5 * (n_inputs / 3.0), 3)

    out["demand_index"] = out["demand_index"].round(4)
    out["demand_pressure"] = out["demand_pressure"].round(4)
    return out[[DATE, "demand_index", "demand_pressure", "trade_trend",
                "demand_confidence"]]


def run(trade_raw: pd.DataFrame,
        daily_calendar: pd.DataFrame,
        publication_lag_months: int = 1) -> pd.DataFrame:
    """Expand monthly trade data to a daily per-port feature table.

    Parameters
    ----------
    trade_raw : monthly frame with columns [port_id, year, month, ...].
    daily_calendar : a frame with [port_id, date] giving the daily grid to fill
                     (typically the observed series' dates).
    """
    if trade_raw is None or trade_raw.empty:
        log.warning("trade_raw is empty; trade expert returns empty frame.")
        return pd.DataFrame(columns=_OUT_COLS)

    cal = daily_calendar.copy()
    cal[DATE] = pd.to_datetime(cal[DATE])

    parts = []
    for pid, g in trade_raw.groupby(PORT_ID, sort=False):
        port_dates = cal.loc[cal[PORT_ID] == pid, DATE]
        if port_dates.empty:
            # No daily grid for this port -> span the trade months themselves.
            start = pd.Timestamp(int(g["year"].min()), int(g["month"].min()), 1)
            end = pd.Timestamp(int(g["year"].max()), int(g["month"].max()), 1) \
                + pd.offsets.MonthEnd(0)
            port_dates = pd.date_range(start, end, freq="D")
        daily_dates = pd.DatetimeIndex(sorted(pd.to_datetime(port_dates).unique()))
        expanded = _expand_one_port(g, daily_dates, publication_lag_months)
        expanded[PORT_ID] = pid
        parts.append(expanded)

    out = pd.concat(parts, ignore_index=True)
    return out[_OUT_COLS]
