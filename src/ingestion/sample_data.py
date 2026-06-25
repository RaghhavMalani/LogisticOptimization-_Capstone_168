"""Synthetic multi-port sample data generator.

Why this exists
---------------
Real AIS feeds are expensive/inconsistent, and the preprocessed CSVs that ship
with the repo are *national* daily z-scored series (not port x date). To make
the whole pipeline demoable end-to-end we generate a coherent, port-level
synthetic dataset in which weather, news and trade shocks drive a persistent
"stress" process, which in turn drives congestion / delay / throughput. The
persistence is what gives the HSMM real regimes to find and the forecaster real
signal to learn.

Everything is generated with a fixed seed so results are reproducible.

Returned bundle (all tidy, keyed by port_id + date)
---------------------------------------------------
    weather_raw   : daily, per port  (wind/rain/wave/visibility/storm)
    news_raw      : daily, per port  (sentiment + event signals)
    port_ops_raw  : daily, per port  (AIS-like vessel activity proxies)
    trade_raw     : MONTHLY, per port (trade volume + demand + macro)
    observed      : daily, per port  (targets: congestion/delay/throughput +
                    utilization) -- the ground truth used for training/eval.
"""

from __future__ import annotations

from typing import Dict

import numpy as np
import pandas as pd

from src.utils.config import DATE, PORT_ID, PORTS, DemoConfig


def _daterange(start: str, n_days: int) -> pd.DatetimeIndex:
    return pd.date_range(start=start, periods=n_days, freq="D")


def generate_sample_data(cfg: DemoConfig | None = None) -> Dict[str, pd.DataFrame]:
    """Generate the full synthetic raw-data bundle.

    Parameters
    ----------
    cfg : DemoConfig
        Controls start date, number of days, ports and seed.
    """
    cfg = cfg or DemoConfig()
    rng = np.random.default_rng(cfg.seed)
    dates = _daterange(cfg.start_date, cfg.n_days)
    ports = [p for p in PORTS if p.port_id in cfg.port_ids]

    weather_rows, news_rows, ops_rows, obs_rows = [], [], [], []
    trade_rows = []

    for p in ports:
        n = len(dates)
        day_idx = np.arange(n)

        # ---- Seasonal / monsoon weather signal -------------------------------
        # West coast monsoon peaks ~ day 180 of the year; add per-port phase.
        doy = dates.dayofyear.to_numpy()
        monsoon = np.clip(np.sin((doy - 150) / 365 * 2 * np.pi), 0, None)
        wind = 8 + 10 * monsoon + rng.normal(0, 2.5, n)              # knots-ish
        rain = np.clip(40 * monsoon + rng.gamma(1.2, 3, n) - 2, 0, None)  # mm
        wave = np.clip(0.8 + 1.8 * monsoon + rng.normal(0, 0.25, n), 0, None)  # m
        visibility = np.clip(10 - 4 * monsoon - rng.gamma(1.0, 0.6, n), 0.5, 10)  # km
        # Occasional cyclone/storm flags, more likely in monsoon.
        storm_prob = 0.01 + 0.05 * monsoon
        storm_flag = (rng.random(n) < storm_prob).astype(int)

        # ---- News / geopolitical event stream --------------------------------
        # Sentiment is an AR(1) process; occasional negative event spikes.
        sentiment = np.zeros(n)
        event_severity = np.zeros(n)
        event_type = np.array(["none"] * n, dtype=object)
        s = 0.0
        event_catalog = ["strike", "policy", "conflict", "weather_warning", "congestion"]
        for t in range(n):
            s = 0.85 * s + rng.normal(0, 0.25)
            sentiment[t] = s
            if rng.random() < 0.04:  # ~4% of days carry a notable event
                event_type[t] = rng.choice(event_catalog)
                event_severity[t] = rng.uniform(0.3, 1.0)
                sentiment[t] -= event_severity[t]  # bad news drags sentiment

        # ---- Latent stress -> drives congestion ------------------------------
        # Stress integrates weather, bad news and a slow random walk so that it
        # is persistent (=> regimes last several days).
        wx_push = 0.04 * (wind - 8) + 0.015 * rain + 0.25 * wave + 0.6 * storm_flag
        news_push = np.clip(-sentiment, 0, None) + 1.5 * event_severity
        stress = np.zeros(n)
        z = 0.0
        for t in range(n):
            z = 0.9 * z + 0.10 * wx_push[t] + 0.10 * news_push[t] + rng.normal(0, 0.15)
            stress[t] = z
        stress = stress - stress.min()

        # Capacity scales how quickly stress turns into congestion.
        cap = p.port_capacity
        congestion = np.clip(25 + 18 * stress / (0.5 + cap) + rng.normal(0, 4, n), 0, 100)
        utilization = np.clip(0.45 + 0.005 * congestion + rng.normal(0, 0.03, n), 0, 1)
        delay_hours = np.clip(2 + 0.6 * congestion + 8 * storm_flag + rng.normal(0, 3, n), 0, None)
        base_throughput = 1000 * cap
        throughput = np.clip(
            base_throughput * (1.1 - 0.006 * congestion) + rng.normal(0, 40, n), 0, None
        )

        # ---- AIS-like vessel activity proxies --------------------------------
        # Higher congestion => more anchored vessels, lower speed near port.
        anchorage = np.clip(np.round(2 + 0.18 * congestion + rng.normal(0, 1.5, n)), 0, None)
        vessel_density = np.clip(
            10 + 0.25 * congestion + 4 * cap + rng.normal(0, 2, n), 0, None
        )
        avg_speed = np.clip(9 - 0.05 * congestion + rng.normal(0, 0.6, n), 1, None)  # knots
        arrivals = np.clip(np.round(6 * cap + rng.normal(0, 1.5, n)), 0, None)
        departures = np.clip(np.round(arrivals - 0.05 * anchorage + rng.normal(0, 1, n)), 0, None)

        for t in range(n):
            d = dates[t]
            weather_rows.append({
                PORT_ID: p.port_id, DATE: d,
                "wind_speed": round(float(wind[t]), 2),
                "rainfall": round(float(rain[t]), 2),
                "wave_height": round(float(wave[t]), 2),
                "visibility": round(float(visibility[t]), 2),
                "storm_flag": int(storm_flag[t]),
            })
            news_rows.append({
                PORT_ID: p.port_id, DATE: d,
                "sentiment": round(float(sentiment[t]), 4),
                "event_type": event_type[t],
                "event_severity": round(float(event_severity[t]), 3),
            })
            ops_rows.append({
                PORT_ID: p.port_id, DATE: d,
                "vessel_density": round(float(vessel_density[t]), 2),
                "avg_speed_near_port": round(float(avg_speed[t]), 2),
                "anchorage_count": int(anchorage[t]),
                "arrival_count": int(arrivals[t]),
                "departure_count": int(departures[t]),
            })
            obs_rows.append({
                PORT_ID: p.port_id, DATE: d,
                "congestion_index": round(float(congestion[t]), 2),
                "delay_hours": round(float(delay_hours[t]), 2),
                "throughput": round(float(throughput[t]), 1),
                "utilization": round(float(utilization[t]), 4),
            })

        # ---- Monthly trade / macro (deliberately coarse) ---------------------
        months = pd.period_range(dates[0], dates[-1], freq="M")
        trend = np.linspace(0, 1, len(months))
        for i, m in enumerate(months):
            trade_rows.append({
                PORT_ID: p.port_id,
                "year": m.year,
                "month": m.month,
                "trade_volume": round(float(50000 * cap * (1 + 0.2 * trend[i])
                                             + rng.normal(0, 1500)), 1),
                "demand_index": round(float(100 * (1 + 0.15 * trend[i])
                                            + rng.normal(0, 3)), 2),
                "macro_iip": round(float(120 + 10 * trend[i] + rng.normal(0, 2)), 2),
            })

    bundle = {
        "weather_raw": pd.DataFrame(weather_rows),
        "news_raw": pd.DataFrame(news_rows),
        "port_ops_raw": pd.DataFrame(ops_rows),
        "trade_raw": pd.DataFrame(trade_rows),
        "observed": pd.DataFrame(obs_rows),
    }
    return bundle


def write_sample_data(cfg: DemoConfig | None = None, out_dir=None) -> Dict[str, str]:
    """Generate and persist the sample bundle to data/sample/ as CSVs."""
    from src.utils.config import SAMPLE_DIR

    cfg = cfg or DemoConfig()
    out_dir = out_dir or SAMPLE_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    bundle = generate_sample_data(cfg)
    paths = {}
    for name, df in bundle.items():
        path = out_dir / f"{name}.csv"
        df.to_csv(path, index=False)
        paths[name] = str(path)
    return paths


if __name__ == "__main__":  # pragma: no cover - manual smoke test
    paths = write_sample_data()
    for k, v in paths.items():
        print(f"wrote {k}: {v}")
