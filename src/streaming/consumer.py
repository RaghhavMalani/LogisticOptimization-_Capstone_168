"""Streaming consumer.

Consumes the day-by-day record stream, maintains a growing rolling window, and
periodically re-runs the pipeline (experts -> HSMM -> forecast -> decision) so
the system produces *live* forecasts as new data arrives. Each refresh emits a
compact per-port summary (and optionally persists it).

This mirrors the diagram's real-time loop without requiring a GPU: it uses the
fast gradient-boosted quantile baseline for the streaming forecast.
"""

from __future__ import annotations

from typing import Callable, Dict, List, Optional

import pandas as pd

from src.streaming.bus import get_bus
from src.experts import (news_expert, port_ops_expert, trade_demand_expert,
                         weather_expert)
from src.regimes.regime_features import assemble_panel
from src.regimes.hsmm_model import HSMMRegimeModel
from src.forecasting.forecast_runner import run_baseline
from src.decision.decision_layer import build_decisions
from src.utils.config import DATE, PORT_ID
from src.utils.logging_utils import get_logger

log = get_logger(__name__)


def _frames_from_buffer(buf: Dict[str, list]) -> Dict[str, pd.DataFrame]:
    def mk(records):
        return pd.DataFrame(records) if records else pd.DataFrame()
    out = {k: mk(v) for k, v in buf.items()}
    for name, df in out.items():
        if not df.empty and DATE in df.columns:
            df[DATE] = pd.to_datetime(df[DATE])
    return out


def run_consumer(bus=None,
                 trade_raw: pd.DataFrame | None = None,
                 warmup_days: int = 60,
                 refresh_every: int = 10,
                 horizon: int = 10,
                 max_records: Optional[int] = None,
                 on_forecast: Optional[Callable[[pd.DataFrame, pd.DataFrame], None]] = None,
                 timeout: float = 2.0) -> Dict[str, pd.DataFrame]:
    """Drain the bus, refreshing the forecast every `refresh_every` new days."""
    bus = bus or get_bus()
    buf = {"weather_raw": [], "news_raw": [], "port_ops_raw": [], "observed": []}
    seen_dates: List[str] = []
    last_refresh = 0
    n = 0
    latest_forecast = pd.DataFrame()
    latest_decisions = pd.DataFrame()

    for key, rec in bus.consume(timeout=timeout):
        n += 1
        pid, date = rec["port_id"], rec["date"]
        base = {PORT_ID: pid, DATE: date}
        if rec.get("observed"):
            buf["observed"].append({**base, **rec["observed"]})
        if rec.get("weather"):
            buf["weather_raw"].append({**base, **rec["weather"]})
        if rec.get("news"):
            buf["news_raw"].append({**base, **rec["news"]})
        if rec.get("port_ops"):
            buf["port_ops_raw"].append({**base, **rec["port_ops"]})

        if date not in seen_dates:
            seen_dates.append(date)

        n_days = len(seen_dates)
        if n_days >= warmup_days and (n_days - last_refresh) >= refresh_every:
            last_refresh = n_days
            latest_forecast, latest_decisions = _refresh(buf, trade_raw, horizon)
            log.info("[stream] day %d: refreshed forecast (%d rows).",
                     n_days, len(latest_forecast))
            if on_forecast:
                on_forecast(latest_forecast, latest_decisions)

        if max_records and n >= max_records:
            break

    log.info("Consumer: processed %d records over %d days.", n, len(seen_dates))
    return {"forecast": latest_forecast, "decisions": latest_decisions}


def _refresh(buf, trade_raw, horizon):
    frames = _frames_from_buffer(buf)
    observed = frames["observed"]
    if observed.empty:
        return pd.DataFrame(), pd.DataFrame()

    weather_now = weather_expert.run(frames["weather_raw"])
    news_feats = news_expert.run(frames["news_raw"])
    port_ops_feats = port_ops_expert.run(frames["port_ops_raw"], observed=observed)
    if trade_raw is not None and not trade_raw.empty:
        trade_feats = trade_demand_expert.run(trade_raw, observed[[PORT_ID, DATE]])
    else:
        trade_feats = pd.DataFrame()

    panel = assemble_panel(observed, weather_now, news_feats, port_ops_feats,
                           trade_feats)
    regimes = HSMMRegimeModel().fit_predict(panel)
    reg_cols = ["p_normal", "p_congested", "p_severe", "days_in_state",
                "expected_remaining_days", "transition_risk", "regime_confidence"]
    panel_fc = panel.merge(
        regimes[[PORT_ID, DATE] + reg_cols].drop_duplicates([PORT_ID, DATE]),
        on=[PORT_ID, DATE], how="left")

    forecast = run_baseline(panel_fc, weather_now, horizon=horizon)
    decisions = build_decisions(forecast, weather_now)
    return forecast, decisions


def run_streaming_demo(bundle: Dict[str, pd.DataFrame], horizon: int = 10,
                       warmup_days: int = 60, refresh_every: int = 30) -> Dict:
    """Convenience: produce the whole bundle onto an in-memory bus, then consume
    it, refreshing the forecast a few times along the way."""
    from src.streaming.producer import stream_bundle
    bus = get_bus(force_memory=True)
    stream_bundle(bundle, bus=bus)
    return run_consumer(bus, trade_raw=bundle.get("trade_raw"),
                        warmup_days=warmup_days, refresh_every=refresh_every,
                        horizon=horizon)
