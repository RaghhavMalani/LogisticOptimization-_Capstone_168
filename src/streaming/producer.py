"""Streaming producer.

Replays the raw bundle as a time-ordered event stream: for each calendar date,
one record per port carrying that day's weather / news / port-ops / observed
fields. This simulates live ASF/AIS + weather + news feeds arriving day by day.
"""

from __future__ import annotations

import time
from typing import Dict

import pandas as pd

from src.streaming.bus import DEFAULT_TOPIC, get_bus
from src.utils.config import DATE, PORT_ID
from src.utils.logging_utils import get_logger

log = get_logger(__name__)


def _index(df: pd.DataFrame):
    if df is None or df.empty or DATE not in df.columns:
        return {}
    d = df.copy()
    d[DATE] = pd.to_datetime(d[DATE])
    return {(r[PORT_ID], r[DATE]): r.to_dict() for _, r in d.iterrows()}


def stream_bundle(bundle: Dict[str, pd.DataFrame], bus=None,
                  delay_sec: float = 0.0, topic: str = DEFAULT_TOPIC) -> int:
    """Publish one merged record per (port, date) in chronological order."""
    bus = bus or get_bus(topic)
    observed = bundle["observed"].copy()
    observed[DATE] = pd.to_datetime(observed[DATE])

    wx = _index(bundle.get("weather_raw"))
    nw = _index(bundle.get("news_raw"))
    po = _index(bundle.get("port_ops_raw"))

    n = 0
    for d, day_group in observed.sort_values(DATE).groupby(DATE):
        for _, obs in day_group.iterrows():
            key = (obs[PORT_ID], d)
            record = {
                "port_id": obs[PORT_ID],
                "date": str(pd.Timestamp(d).date()),
                "observed": _clean(obs.to_dict()),
                "weather": _clean(wx.get(key, {})),
                "news": _clean(nw.get(key, {})),
                "port_ops": _clean(po.get(key, {})),
            }
            bus.publish(obs[PORT_ID], record)
            n += 1
        if delay_sec:
            time.sleep(delay_sec)
    bus.flush()
    log.info("Producer: published %d records to topic '%s' (%s).",
             n, getattr(bus, "topic", topic), getattr(bus, "backend", "?"))
    return n


def _clean(d: dict) -> dict:
    out = {}
    for k, v in d.items():
        if k in (PORT_ID, DATE):
            continue
        out[k] = (str(v) if isinstance(v, (pd.Timestamp,)) else v)
    return out
