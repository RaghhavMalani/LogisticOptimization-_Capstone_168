"""Unified data loading.

`load_raw_bundle()` returns a dict of tidy DataFrames with the keys the rest of
the pipeline expects:

    weather_raw, news_raw, port_ops_raw, trade_raw, observed

Source selection
----------------
  * source="sample"    -> generate (or read) the synthetic multi-port dataset.
  * source="portwatch" -> REAL daily port-level data from the cached IMF
                          PortWatch satellite-AIS feed (vessel calls +
                          import/export tonnes per Indian port per day). The
                          best real source available: true per-port daily
                          signal, refreshable via `python -m app.data.portwatch`.
  * source="real"      -> best-effort adapter over the preprocessed CSVs that
                          ship in data/preprocessed/ (national 2020-22 series +
                          monthly DGQI dwell times broadcast across ports).
  * source="auto"      -> portwatch cache if present, else real CSVs, else sample.

The real adapter is intentionally conservative: any signal it cannot build is
simply omitted, and downstream experts degrade gracefully (lower confidence).
"""

from __future__ import annotations

from typing import Dict

import numpy as np
import pandas as pd

from src.utils.config import (
    DATE,
    DGQI_PORT_ALIASES,
    PORT_ID,
    PORT_IDS,
    PREPROCESSED_DIR,
    SAMPLE_DIR,
    DemoConfig,
)
from src.utils.logging_utils import get_logger
from src.ingestion.sample_data import generate_sample_data

log = get_logger(__name__)

_REQUIRED_KEYS = ["weather_raw", "news_raw", "port_ops_raw", "trade_raw", "observed"]


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------
def load_raw_bundle(source: str = "auto", cfg: DemoConfig | None = None
                    ) -> Dict[str, pd.DataFrame]:
    cfg = cfg or DemoConfig()
    source = source.lower()

    if source == "sample":
        return _load_sample(cfg)
    if source == "portwatch":
        return _load_portwatch()
    if source == "real":
        return _load_real(cfg)
    if source == "auto":
        if _portwatch_available():
            try:
                bundle = _load_portwatch()
                log.info("Loaded REAL IMF PortWatch data (auto).")
                return bundle
            except Exception as exc:  # pragma: no cover - defensive
                log.warning("PortWatch load failed (%s); trying next source.", exc)
        if _real_available():
            try:
                bundle = _load_real(cfg)
                log.info("Loaded REAL preprocessed data (auto).")
                return bundle
            except Exception as exc:  # pragma: no cover - defensive
                log.warning("Real data load failed (%s); falling back to sample.", exc)
        return _load_sample(cfg)
    raise ValueError(f"Unknown source '{source}' (use sample|portwatch|real|auto)")


# ---------------------------------------------------------------------------
# PortWatch path (real satellite-AIS daily port activity)
# ---------------------------------------------------------------------------
def _portwatch_available() -> bool:
    try:
        from src.ingestion import portwatch_source
        return portwatch_source.available()
    except Exception:  # pragma: no cover
        return False


def _load_portwatch() -> Dict[str, pd.DataFrame]:
    from src.ingestion import portwatch_source
    bundle = portwatch_source.load_bundle()
    for k in _REQUIRED_KEYS:
        bundle.setdefault(k, pd.DataFrame(columns=[PORT_ID, DATE]))
    return bundle


# ---------------------------------------------------------------------------
# Sample path
# ---------------------------------------------------------------------------
def _load_sample(cfg: DemoConfig) -> Dict[str, pd.DataFrame]:
    # Prefer on-disk sample CSVs if present (so the demo is inspectable), else
    # generate fresh in-memory.
    csvs = {k: SAMPLE_DIR / f"{k}.csv" for k in _REQUIRED_KEYS}
    if all(p.exists() for p in csvs.values()):
        log.info("Loading sample data from %s", SAMPLE_DIR)
        bundle = {}
        for k, p in csvs.items():
            df = pd.read_csv(p)
            if DATE in df.columns:
                df[DATE] = pd.to_datetime(df[DATE])
            bundle[k] = df
        return bundle
    log.info("Generating synthetic sample data in-memory (seed=%s).", cfg.seed)
    return generate_sample_data(cfg)


# ---------------------------------------------------------------------------
# Real path (best-effort adapter over the shipped preprocessed CSVs)
# ---------------------------------------------------------------------------
def _real_available() -> bool:
    return PREPROCESSED_DIR.exists() and any(PREPROCESSED_DIR.glob("*.csv"))


def _broadcast_to_ports(df: pd.DataFrame, port_ids=None) -> pd.DataFrame:
    """Replicate a national (port-agnostic) daily frame across all ports."""
    port_ids = port_ids or PORT_IDS
    frames = []
    for pid in port_ids:
        d = df.copy()
        d[PORT_ID] = pid
        frames.append(d)
    return pd.concat(frames, ignore_index=True)


def _load_real(cfg: DemoConfig) -> Dict[str, pd.DataFrame]:
    bundle: Dict[str, pd.DataFrame] = {}

    # --- Weather (national daily) -> broadcast --------------------------------
    wpath = PREPROCESSED_DIR / "weather_preprocessed_2020_2022.csv"
    if wpath.exists():
        w = pd.read_csv(wpath)
        w = w.rename(columns={"Date": DATE})
        w[DATE] = pd.to_datetime(w[DATE], errors="coerce")
        w = w.dropna(subset=[DATE])
        # Map z-scored columns to the names the weather expert understands.
        ren = {"WindSpeed": "wind_speed", "Rainfall": "rainfall"}
        w = w.rename(columns=ren)
        keep = [DATE] + [c for c in ["wind_speed", "rainfall", "Temperature"] if c in w.columns]
        w = w[keep].copy()
        # These are standardized; the weather expert is scale-aware via ranking,
        # but we still provide proxy wave/visibility/storm so columns exist.
        w["wave_height"] = np.nan
        w["visibility"] = np.nan
        w["storm_flag"] = 0
        bundle["weather_raw"] = _broadcast_to_ports(w)

    # --- News (national daily) -> broadcast -----------------------------------
    npath = PREPROCESSED_DIR / "maritime_news_preprocessed.csv"
    if npath.exists():
        nn = pd.read_csv(npath).rename(columns={"Date": DATE})
        nn[DATE] = pd.to_datetime(nn[DATE], errors="coerce")
        nn = nn.dropna(subset=[DATE])[[DATE, "sentiment"]].copy()
        nn["event_type"] = "none"
        nn["event_severity"] = 0.0
        bundle["news_raw"] = _broadcast_to_ports(nn)

    # --- Trade / economic (national daily) -> monthly per port ----------------
    epath = PREPROCESSED_DIR / "final_economic_features.csv"
    if epath.exists():
        e = pd.read_csv(epath).rename(columns={"Date": DATE})
        e[DATE] = pd.to_datetime(e[DATE], errors="coerce")
        e = e.dropna(subset=[DATE])
        e["year"] = e[DATE].dt.year
        e["month"] = e[DATE].dt.month
        agg = (e.groupby(["year", "month"])
                 .agg(demand_index=("IIP_Value", "mean"),
                      macro_iip=("IIP_Value", "mean"),
                      trade_volume=("Global_LSCI", "mean"))
                 .reset_index())
        bundle["trade_raw"] = _broadcast_to_ports(agg)

    # --- DGQI dwell time -> real port-level congestion proxy (monthly) --------
    dpath = PREPROCESSED_DIR / "DGQI_merged_2020_2022.csv"
    observed = None
    if dpath.exists():
        dg = pd.read_csv(dpath)
        dg["port_id"] = dg["portName"].str.upper().map(DGQI_PORT_ALIASES)
        dg = dg.dropna(subset=["port_id"])
        month_map = {m.upper(): i + 1 for i, m in enumerate(
            ["January", "February", "March", "April", "May", "June", "July",
             "August", "September", "October", "November", "December"])}
        dg["month_num"] = dg["month"].astype(str).str.upper().map(month_map)
        dg = dg.dropna(subset=["month_num"])
        monthly = (dg.groupby(["port_id", "year", "month_num"])["dwellTime"]
                     .mean().reset_index())
        # Expand monthly dwell time to a daily observed congestion proxy.
        rows = []
        for _, r in monthly.iterrows():
            start = pd.Timestamp(int(r["year"]), int(r["month_num"]), 1)
            days = pd.date_range(start, start + pd.offsets.MonthEnd(0), freq="D")
            # Scale dwell time (hours) to a 0-100 congestion-like index.
            cong = float(np.clip(r["dwellTime"], 0, 200)) / 2.0
            for d in days:
                rows.append({PORT_ID: r["port_id"], DATE: d,
                             "congestion_index": cong,
                             "delay_hours": float(r["dwellTime"]),
                             "throughput": np.nan,
                             "utilization": np.nan})
        observed = pd.DataFrame(rows)

    if observed is None:
        raise FileNotFoundError("No DGQI port-level data; cannot build 'observed'.")
    bundle["observed"] = observed

    # AIS proxy: no real AIS available -> leave empty; the port-ops expert will
    # synthesise proxies from the observed congestion (fallback mode).
    bundle.setdefault("port_ops_raw", pd.DataFrame(columns=[PORT_ID, DATE]))

    # Ensure all keys exist (empty frames are fine; experts degrade gracefully).
    for k in _REQUIRED_KEYS:
        bundle.setdefault(k, pd.DataFrame(columns=[PORT_ID, DATE]))
    return bundle
