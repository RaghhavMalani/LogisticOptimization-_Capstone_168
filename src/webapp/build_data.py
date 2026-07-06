"""Build the JSON payload the next-gen web app consumes.

Reads the pipeline outputs (forecast, regimes, decisions, analytics, markets,
provenance) and writes a single `data.json` next to index.html containing:
  ports      : per-port coords + regime + forecast curve + analytics
  vessels    : synthetic inbound voyages (foreign hub -> Indian port) for the
               animated radar map (real AIS slots in here later)
  chokepoints, tickers, national, provenance

Run via `python -m src.webapp.build_data` or the run_demo `--web` flag.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from src.utils.config import (ANALYTICS_DIR, FORECASTS_DIR, REGIMES_DIR,
                              PORT_BY_ID, PORT_ID)
from src.decision.route_optimizer import PORT_COORDS
from src.utils.logging_utils import get_logger

log = get_logger(__name__)

WEBAPP_DIR = Path(__file__).resolve().parent

# Foreign hubs that feed Indian trade (for inbound voyage animation).
HUBS = {
    "Singapore": (1.29, 103.85), "Shanghai": (31.2, 121.5),
    "Jebel Ali": (25.0, 55.1), "Hormuz": (26.6, 56.3),
    "Suez": (30.0, 32.5), "Rotterdam": (51.9, 4.5),
    "Colombo": (6.9, 79.85), "Port Klang": (3.0, 101.4),
    "Durban": (-29.8, 31.0),
}


def _read(p):
    if p.exists():
        df = pd.read_csv(p)
        for c in ("date", "target_date", "forecast_origin_date"):
            if c in df.columns:
                df[c] = pd.to_datetime(df[c], errors="coerce")
        return df
    return pd.DataFrame()


def _latest_quote(df, col):
    if df.empty or col not in df.columns:
        return None
    s = df[col].astype(float)
    last = float(s.iloc[-1]); prev = float(s.iloc[-2]) if len(s) > 1 else last
    return {"value": round(last, 2),
            "change_pct": round((last - prev) / prev * 100, 2) if prev else 0.0}


def generate(seed: int = 42) -> Path:
    rng = np.random.default_rng(seed)
    forecast = _read(FORECASTS_DIR / "forecast_table.csv")
    regimes = _read(REGIMES_DIR / "regimes.csv")
    decisions = _read(FORECASTS_DIR / "decisions.csv")
    league = _read(ANALYTICS_DIR / "league_table.csv")
    var = _read(ANALYTICS_DIR / "value_at_risk.csv")
    brent = _read(FORECASTS_DIR / "market_brent.csv")
    freight = _read(FORECASTS_DIR / "market_freight.csv")
    choke = _read(FORECASTS_DIR / "chokepoints.csv")

    if forecast.empty:
        raise SystemExit("No forecast outputs. Run run_demo first.")

    lg = league.set_index("port_id") if not league.empty else pd.DataFrame()
    vr = var.set_index("port_id") if not var.empty else pd.DataFrame()

    ports, vessels = [], []
    vid = 0
    for pid, f in forecast.groupby(PORT_ID):
        f = f.sort_values("horizon_day")
        lat, lon = PORT_COORDS.get(pid, (None, None))
        if lat is None:
            continue
        reg, rem = "CONGESTED", None
        if not regimes.empty:
            rp = regimes[regimes[PORT_ID] == pid].sort_values("date")
            if not rp.empty:
                reg = str(rp["regime_label"].iloc[-1])
                rem = round(float(rp["expected_remaining_days"].iloc[-1]), 1)
        risk = f["risk_level"].mode()
        prob = None
        if not decisions.empty:
            d = decisions[decisions[PORT_ID] == pid]
            if not d.empty:
                prob = round(float(d["congestion_probability"].mean()), 2)
        ports.append({
            "id": pid,
            "name": PORT_BY_ID[pid].name if pid in PORT_BY_ID else pid,
            "region": PORT_BY_ID[pid].region if pid in PORT_BY_ID else "",
            "lat": lat, "lon": lon, "regime": reg,
            "risk": risk.iloc[0] if not risk.empty else "Unknown",
            "peak_q50": round(float(f["q50"].max()), 1),
            "peak_q90": round(float(f["q90"].max()), 1),
            "exp_remaining": rem, "congestion_prob": prob,
            "cargo_mt": float(lg.loc[pid, "cargo_mt"]) if pid in getattr(lg, "index", []) and "cargo_mt" in lg.columns else None,
            "turnaround_days": float(lg.loc[pid, "turnaround_days"]) if pid in getattr(lg, "index", []) and "turnaround_days" in lg.columns else None,
            "efficiency_score": float(lg.loc[pid, "efficiency_score"]) if pid in getattr(lg, "index", []) and "efficiency_score" in lg.columns else None,
            "value_at_risk": float(vr.loc[pid, "value_at_risk_inr_cr"]) if pid in getattr(vr, "index", []) and "value_at_risk_inr_cr" in vr.columns else None,
            "forecast": [{"h": int(r.horizon_day), "q10": round(float(r.q10), 1),
                          "q50": round(float(r.q50), 1), "q90": round(float(r.q90), 1),
                          "delay": (round(float(r.predicted_delay), 1)
                                    if pd.notna(r.predicted_delay) else None)}
                         for r in f.itertuples()],
        })
        # inbound vessels for this port (more when congested)
        n = 2 + (1 if reg == "CONGESTED" else 2 if reg == "SEVERE" else 0)
        hubs = list(HUBS.items())
        for _ in range(n):
            hub, (hlat, hlon) = hubs[rng.integers(0, len(hubs))]
            vid += 1
            vessels.append({
                "id": f"MV{200 + vid}", "from": hub, "to": pid,
                "src": [hlon, hlat], "dst": [lon, lat],
                "progress": round(float(rng.random()), 3),
                "eta_days": int(rng.integers(1, 11)),
                "regime": reg,
            })

    payload = {
        "generated": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M"),
        "ports": ports, "vessels": vessels,
        "chokepoints": ([] if choke.empty else
                        choke.sort_values("date").groupby("name").tail(1)
                        [["name", "status", "vs_baseline_pct"]].to_dict("records")),
        "tickers": {"brent": _latest_quote(brent, "brent_usd"),
                    "freight": _latest_quote(freight, "freight_index")},
        "national": _national(forecast, regimes, var),
        "provenance": _provenance(),
        "india_geo": _india_geo(),
    }
    WEBAPP_DIR.mkdir(parents=True, exist_ok=True)
    out = WEBAPP_DIR / "data.json"
    out.write_text(json.dumps(payload), encoding="utf-8")
    log.info("Web data written: %s (%d ports, %d vessels)",
             out, len(ports), len(vessels))
    return out


def _national(forecast, regimes, var):
    d = {"ports": int(forecast[PORT_ID].nunique())}
    if not regimes.empty:
        last = regimes.sort_values("date").groupby(PORT_ID).tail(1)
        vc = last["regime_label"].value_counts().to_dict()
        d["severe"] = int(vc.get("SEVERE", 0))
        d["congested"] = int(vc.get("CONGESTED", 0))
    if not var.empty and "value_at_risk_inr_cr" in var.columns:
        d["value_at_risk"] = round(float(var["value_at_risk_inr_cr"].sum()), 0)
    return d


def _india_geo():
    """Fetch a real India boundary once (Python has internet) and embed it, so
    the browser never has to fetch map geometry. Returns a list of rings."""
    from src.ingestion.connectors.base import cached_text
    sources = [
        ("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/"
         "geojson/ne_50m_admin_0_countries.geojson", "ne50_countries"),
        ("https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/"
         "ne_110m_admin_0_countries.geojson", "ne110_countries"),
    ]
    gj = None
    for url, key in sources:
        try:
            txt = cached_text(url, key=key, ttl=30 * 24 * 3600)
            if txt:
                gj = json.loads(txt)
                break
        except Exception:
            continue
    try:
        if not gj:
            return None
        for f in gj.get("features", []):
            pr = f.get("properties", {})
            nm = (pr.get("NAME") or pr.get("name") or pr.get("ADMIN") or "").lower()
            if nm == "india":
                geom = f["geometry"]
                polys = (geom["coordinates"] if geom["type"] == "MultiPolygon"
                         else [geom["coordinates"]])
                rings = []
                for poly in polys:
                    outer = poly[0]
                    if len(outer) >= 6:
                        step = max(1, len(outer) // 220)
                        rings.append([[round(c[0], 3), round(c[1], 3)]
                                      for c in outer[::step]])
                rings.sort(key=len, reverse=True)
                log.info("Embedded real India boundary (%d rings).", len(rings))
                return rings[:6]
    except Exception as exc:  # pragma: no cover
        log.warning("India geo fetch failed (%s); web app uses fallback outline.", exc)
    return None


def _provenance():
    p = ANALYTICS_DIR / "provenance.json"
    if p.exists():
        try:
            return json.loads(p.read_text())
        except Exception:
            return {}
    return {}


if __name__ == "__main__":
    generate()
