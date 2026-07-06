"""IMF PortWatch as a REAL data source for the forecasting pipeline.

PortWatch (IMF + Oxford) publishes daily, satellite-AIS-derived port activity
for 2,000+ ports as public ArcGIS feature services (no API key). For India this
gives us, per port and day: vessel port calls (by ship type) and import/export
trade-volume estimates in tonnes. That is exactly the AIS-proxy signal the
Port-Ops expert was designed around -- but *measured*, not synthesised.

This module turns the cached PortWatch data under data/portwatch/ into the raw
bundle the pipeline expects (observed, port_ops_raw, weather_raw, news_raw,
trade_raw). Fetching/refreshing the cache is done by ``app.data.portwatch``
(run ``python -m app.data.portwatch`` on a machine with open network access);
this module is read-only over the cache so the demo never needs the network.

Cache layout
------------
    data/portwatch/port_activity.csv       full-schema recent snapshot
    data/portwatch/history/<portid>.csv    longer per-port history
                                           (date,portcalls,import,export)
    data/portwatch/disruptions.csv         GDACS climate/disaster events with
                                           affected ports (storm flags)

Derived observed series (leakage-safe: every baseline is an *expanding*
statistic shifted one day, so day t only ever uses information up to t-1):

    throughput        7-day trailing mean of import+export tonnes (real).
    utilization       trailing activity vs. the port's own historical peak.
    congestion_index  0-100 pressure index: trailing 7-day vessel calls vs the
                      port's expanding baseline (100 = double the usual calls).
    delay_hours       berth-wait PROXY in hours derived from call pressure --
                      clearly a proxy (no measured berth delays are public);
                      replace with port-authority dwell times when available.
"""

from __future__ import annotations

from typing import Dict

import numpy as np
import pandas as pd

from src.utils.config import DATA_DIR, DATE, PORT_ID, PORT_IDS
from src.utils.logging_utils import get_logger

log = get_logger(__name__)

PW_DIR = DATA_DIR / "portwatch"
HISTORY_DIR = PW_DIR / "history"

# PortWatch portid -> canonical pipeline port_id. Haldia is folded into
# KOLKATA to match the config registry ("Kolkata / Haldia").
PORTID_TO_CANON: Dict[str, str] = {
    "port776": "JNPT", "port777": "MUNDRA", "port540": "DEENDAYAL",
    "port235": "CHENNAI", "port207": "KOLKATA", "port442": "KOLKATA",
    "port1367": "VIZAG", "port883": "PARADIP", "port583": "COCHIN",
    "port1331": "TUTICORIN", "port534": "KAMARAJAR",
    "port811": "NEW_MANGALORE", "port709": "MORMUGAO",
}

_GDACS_SEVERITY = {"RED": 1.0, "ORANGE": 0.6, "GREEN": 0.3}


def available() -> bool:
    """True when enough cached PortWatch activity exists to run the pipeline."""
    if HISTORY_DIR.exists() and any(HISTORY_DIR.glob("*.csv")):
        return True
    return (PW_DIR / "port_activity.csv").exists()


# ---------------------------------------------------------------------------
# Raw activity loading
# ---------------------------------------------------------------------------
def _load_activity() -> pd.DataFrame:
    """Merge the per-port history files with the full-schema snapshot.

    Returns one row per (port_id, date) with portcalls / import / export,
    summing PortWatch ports that map to the same canonical port (Kolkata+Haldia).
    """
    frames = []
    if HISTORY_DIR.exists():
        for path in sorted(HISTORY_DIR.glob("*.csv")):
            pid = path.stem
            if pid not in PORTID_TO_CANON:
                continue
            df = pd.read_csv(path, parse_dates=["date"])
            df["portid"] = pid
            frames.append(df[["date", "portid", "portcalls", "import", "export"]])
    snap_path = PW_DIR / "port_activity.csv"
    if snap_path.exists():
        snap = pd.read_csv(snap_path, parse_dates=["date"])
        keep = [c for c in ["date", "portid", "portcalls", "import", "export"]
                if c in snap.columns]
        frames.append(snap[keep])
    if not frames:
        raise FileNotFoundError(
            "No PortWatch cache found. Run `python -m app.data.portwatch` on a "
            "machine with network access to populate data/portwatch/.")

    raw = pd.concat(frames, ignore_index=True)
    raw = raw[raw["portid"].isin(PORTID_TO_CANON)].copy()
    raw[PORT_ID] = raw["portid"].map(PORTID_TO_CANON)
    for c in ["portcalls", "import", "export"]:
        raw[c] = pd.to_numeric(raw[c], errors="coerce").fillna(0.0)
    # History + snapshot overlap on recent dates -> keep one row per
    # (portid, date) first, then sum portids that share a canonical port.
    raw = raw.drop_duplicates(subset=["portid", "date"], keep="first")
    agg = (raw.groupby([PORT_ID, "date"], as_index=False)
              [["portcalls", "import", "export"]].sum()
              .rename(columns={"date": DATE}))

    # Dense daily grid per port (a day with no detected call is a real zero in
    # satellite-AIS terms, not a gap).
    dense = []
    for pid, g in agg.groupby(PORT_ID):
        idx = pd.date_range(g[DATE].min(), g[DATE].max(), freq="D")
        g = (g.set_index(DATE).reindex(idx).rename_axis(DATE).reset_index())
        g[PORT_ID] = pid
        g[["portcalls", "import", "export"]] = (
            g[["portcalls", "import", "export"]].fillna(0.0))
        dense.append(g)
    out = pd.concat(dense, ignore_index=True).sort_values([PORT_ID, DATE])
    log.info("PortWatch activity: %d rows, %d ports, %s..%s.",
             len(out), out[PORT_ID].nunique(),
             out[DATE].min().date(), out[DATE].max().date())
    return out.reset_index(drop=True)


# ---------------------------------------------------------------------------
# Observed series (targets) -- leakage-safe derivations
# ---------------------------------------------------------------------------
def _trailing(s: pd.Series, window: int = 7) -> pd.Series:
    """Strictly backward-looking rolling mean (includes today, never tomorrow)."""
    return s.rolling(window, min_periods=1).mean()


def _expanding_baseline(s: pd.Series, min_periods: int = 14) -> pd.Series:
    """Expanding mean of everything *before* today (shift(1) => no leakage)."""
    return s.expanding(min_periods=min_periods).mean().shift(1)


def _build_observed(act: pd.DataFrame) -> pd.DataFrame:
    parts = []
    for pid, g in act.groupby(PORT_ID):
        g = g.sort_values(DATE).copy()
        calls7 = _trailing(g["portcalls"])
        tonnes7 = _trailing(g["import"] + g["export"])
        base = _expanding_baseline(calls7)
        ratio = (calls7 / base).replace([np.inf, -np.inf], np.nan)

        g["throughput"] = tonnes7.round(1)
        # Congestion pressure: 50 = at baseline, 100 = 2x the usual call level.
        g["congestion_index"] = (50.0 * ratio).clip(0, 100).round(2)
        peak = calls7.expanding(min_periods=14).max().shift(1)
        g["utilization"] = (calls7 / peak).clip(0, 1.2).round(3)
        # Berth-wait PROXY (hours): excess call pressure over baseline mapped to
        # 0..36h on top of a 4h handling floor. A stand-in until measured
        # port-authority dwell/berth data is wired in -- see docs/DATA_SOURCES.md.
        g["delay_hours"] = (4.0 + 18.0 * (ratio - 1.0).clip(0, 2)).round(2)
        parts.append(g)
    obs = pd.concat(parts, ignore_index=True)
    # First ~2 weeks have no baseline yet -> backfill with the earliest defined
    # value per port so the panel stays dense (flagged by lower confidence).
    for c in ["congestion_index", "utilization", "delay_hours"]:
        obs[c] = obs.groupby(PORT_ID)[c].transform(lambda s: s.bfill())
    return obs[[PORT_ID, DATE, "congestion_index", "delay_hours",
                "throughput", "utilization"]]


# ---------------------------------------------------------------------------
# GDACS disruptions -> storm flags for the weather expert
# ---------------------------------------------------------------------------
def _storm_flags(dates_by_port: pd.DataFrame) -> pd.DataFrame:
    """Per (port_id, date) storm severity 0..1 from cached GDACS disruptions."""
    out = dates_by_port.copy()
    out["storm_flag"] = 0.0
    path = PW_DIR / "disruptions.csv"
    if not path.exists():
        return out
    try:
        ev = pd.read_csv(path)
    except Exception as exc:  # pragma: no cover
        log.warning("Could not read disruptions cache: %s", exc)
        return out
    need = {"fromdate", "affectedports"}
    if not need <= set(ev.columns):
        return out
    ev["from"] = pd.to_datetime(ev["fromdate"], unit="ms", errors="coerce")
    ev["to"] = pd.to_datetime(ev.get("todate"), unit="ms", errors="coerce")
    ev["to"] = ev["to"].fillna(ev["from"] + pd.Timedelta(days=3))
    ev["sev"] = (ev.get("alertlevel", pd.Series(dtype=str)).astype(str)
                   .str.upper().map(_GDACS_SEVERITY).fillna(0.3))
    n_hits = 0
    for _, r in ev.dropna(subset=["from"]).iterrows():
        ports = {p.strip() for p in str(r["affectedports"]).split(";")}
        canon = {PORTID_TO_CANON[p] for p in ports if p in PORTID_TO_CANON}
        if not canon:
            continue
        mask = (out[PORT_ID].isin(canon)
                & (out[DATE] >= r["from"]) & (out[DATE] <= r["to"]))
        if mask.any():
            out.loc[mask, "storm_flag"] = np.maximum(
                out.loc[mask, "storm_flag"], r["sev"])
            n_hits += int(mask.sum())
    if n_hits:
        log.info("GDACS disruptions matched %d port-days.", n_hits)
    return out


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------
def load_bundle() -> Dict[str, pd.DataFrame]:
    """Build the raw bundle (observed/port_ops/weather/news/trade) from cache."""
    act = _load_activity()
    observed = _build_observed(act)

    # Port-ops raw: the real AIS-derived activity; the Port-Ops expert detects
    # these columns and runs in PORTWATCH (real) mode.
    port_ops_raw = act[[PORT_ID, DATE, "portcalls", "import", "export"]].copy()

    # Weather raw: physical fields are not in PortWatch (wire Open-Meteo for
    # those -- see docs/DATA_SOURCES.md); GDACS gives real storm/cyclone flags.
    weather_raw = _storm_flags(observed[[PORT_ID, DATE]].copy())
    for c in ["wind_speed", "rainfall", "wave_height", "visibility"]:
        weather_raw[c] = np.nan

    # News raw: intentionally empty here -- national event risk is covered by
    # the macro/GDELT expert; port-level news needs the GDELT DOC API (docs).
    news_raw = pd.DataFrame(columns=[PORT_ID, DATE])

    # Trade raw: monthly per-port totals from the same satellite estimates.
    m = act.copy()
    m["year"], m["month"] = m[DATE].dt.year, m[DATE].dt.month
    trade_raw = (m.groupby([PORT_ID, "year", "month"], as_index=False)
                   .agg(trade_volume=("import", lambda s: float(s.sum())),
                        demand_index=("portcalls", "mean")))
    trade_raw["trade_volume"] += (m.groupby([PORT_ID, "year", "month"])
                                    ["export"].sum().to_numpy())

    missing = sorted(set(PORT_IDS) - set(observed[PORT_ID].unique()))
    if missing:
        log.info("PortWatch source covers %d/%d registry ports (no data: %s).",
                 observed[PORT_ID].nunique(), len(PORT_IDS), ", ".join(missing))
    return {"observed": observed, "port_ops_raw": port_ops_raw,
            "weather_raw": weather_raw, "news_raw": news_raw,
            "trade_raw": trade_raw}
