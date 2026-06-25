"""Port Ops / AIS-Proxy Expert Module.

Converts AIS-like (or satellite-derived) vessel-activity data into port
congestion features. Because reliable AIS is hard to source right now, this
expert supports two modes:

  * REAL  : `port_ops_raw` is provided with vessel activity columns. We compute
            queue / turnaround proxies directly and report high ais_confidence.
  * PROXY : `port_ops_raw` is missing/empty. We synthesise plausible vessel
            activity from the observed congestion series (a satellite/AIS
            *fallback*) and report low ais_confidence so the rest of the system
            knows the AIS signal is imputed.

Output columns (per the project spec)
-------------------------------------
    port_id, date, vessel_density, avg_speed_near_port, anchorage_count,
    arrival_count, departure_count, queue_proxy, turnaround_proxy, ais_confidence
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from src.utils.config import DATE, PORT_ID, RANDOM_SEED
from src.experts.base import minmax01, sort_key
from src.utils.logging_utils import get_logger

log = get_logger(__name__)

_OUT_COLS = [PORT_ID, DATE, "vessel_density", "avg_speed_near_port",
             "anchorage_count", "arrival_count", "departure_count",
             "queue_proxy", "turnaround_proxy", "ais_confidence"]

_AIS_COLS = ["vessel_density", "avg_speed_near_port", "anchorage_count",
             "arrival_count", "departure_count"]


def _derive_proxies(df: pd.DataFrame) -> pd.DataFrame:
    """Given real-ish AIS columns, compute queue/turnaround proxies (0..1-ish)."""
    out = df.copy()

    # queue_proxy: pressure from anchored vessels relative to arrivals.
    anch = out["anchorage_count"].astype(float)
    arr = out["arrival_count"].astype(float).clip(lower=1)
    out["queue_proxy"] = (anch / (arr + anch)).clip(0, 1)

    # turnaround_proxy: slow average speed + many anchored => slow turnaround.
    speed_term = 1.0 - minmax01(out["avg_speed_near_port"])
    queue_term = minmax01(anch)
    out["turnaround_proxy"] = (0.6 * speed_term + 0.4 * queue_term).clip(0, 1)

    for c in ["queue_proxy", "turnaround_proxy"]:
        out[c] = out[c].round(4)
    return out


def _synthesise_from_congestion(observed: pd.DataFrame, seed: int) -> pd.DataFrame:
    """PROXY fallback: build AIS-like activity from observed congestion."""
    rng = np.random.default_rng(seed)
    df = sort_key(observed)[[PORT_ID, DATE, "congestion_index"]].copy()
    c = df["congestion_index"].astype(float).fillna(df["congestion_index"].median())

    df["anchorage_count"] = np.clip(np.round(2 + 0.18 * c
                                             + rng.normal(0, 1.0, len(df))), 0, None)
    df["vessel_density"] = np.clip(10 + 0.25 * c + rng.normal(0, 2, len(df)), 0, None)
    df["avg_speed_near_port"] = np.clip(9 - 0.05 * c + rng.normal(0, 0.5, len(df)),
                                        1, None)
    df["arrival_count"] = np.clip(np.round(6 + rng.normal(0, 1.5, len(df))), 0, None)
    df["departure_count"] = np.clip(np.round(df["arrival_count"]
                                             + rng.normal(0, 1, len(df))), 0, None)
    df = df.drop(columns=["congestion_index"])
    return df


def run(port_ops_raw: pd.DataFrame | None,
        observed: pd.DataFrame | None = None,
        seed: int = RANDOM_SEED) -> pd.DataFrame:
    """Produce port-ops features. Falls back to a congestion-derived proxy when
    no AIS data is available.
    """
    from src.utils import provenance
    have_ais = (port_ops_raw is not None and not port_ops_raw.empty
                and all(c in port_ops_raw.columns for c in _AIS_COLS))
    provenance.record("AIS / vessel activity", provenance.SYNTHETIC,
                      "AIS-like sample" if have_ais else
                      "proxy from congestion; wire GEE Sentinel-1 to go real")

    if have_ais:
        log.info("Port-ops expert: using REAL/sample AIS-like data.")
        df = sort_key(port_ops_raw)
        feats = _derive_proxies(df)
        feats["ais_confidence"] = 0.9
    elif observed is not None and not observed.empty and "congestion_index" in observed:
        log.warning("Port-ops expert: no AIS data -> PROXY mode "
                    "(synthesising vessel activity from observed congestion).")
        df = _synthesise_from_congestion(observed, seed)
        feats = _derive_proxies(df)
        feats["ais_confidence"] = 0.35  # imputed -> low confidence
    else:
        log.error("Port-ops expert: no AIS data and no observed congestion; "
                  "returning empty frame.")
        return pd.DataFrame(columns=_OUT_COLS)

    feats["ais_confidence"] = feats["ais_confidence"].astype(float).round(3)
    for c in _AIS_COLS:
        feats[c] = feats[c].round(3)
    return feats[_OUT_COLS]
