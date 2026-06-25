"""Event-shock scenario engine -- the 'dynamic' brain of the system.

Given a typed shock (e.g. Strait of Hormuz closure), it:
  1. walks the geo-causal graph  chokepoint -> exposed ports -> commodities,
  2. uses the impact model to quantify per-port effects (congestion uplift,
     delay/throughput multipliers, extra steaming days) and market effects
     (oil + freight % moves),
  3. produces a *shock-adjusted forecast* by transforming the baseline/TFT
     forecast table, and
  4. writes a plain-language briefing.

It can run preset what-if scenarios OR auto-detect active shocks from the live
events feed (the "dynamic, event-prioritising" behaviour you asked for).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

import numpy as np
import pandas as pd

from src.decision.impact_model import port_impact, market_impact
from src.ingestion.connectors.portwatch import CHOKEPOINTS, port_exposure
from src.utils.config import PORT_BY_ID, PORT_ID, PORT_IDS
from src.utils.logging_utils import get_logger

log = get_logger(__name__)


@dataclass
class Shock:
    shock_type: str                 # chokepoint_closure | conflict | strike | ...
    severity: float = 0.7           # 0..1
    chokepoint: Optional[str] = None
    label: str = ""
    duration_days: int = 14

    def title(self) -> str:
        if self.label:
            return self.label
        where = CHOKEPOINTS.get(self.chokepoint, {}).get("name", self.chokepoint or "global")
        return f"{self.shock_type.replace('_', ' ').title()} @ {where}"


# Ready-made scenarios for the demo / terminal buttons.
PRESETS: Dict[str, Shock] = {
    "hormuz_closure": Shock("chokepoint_closure", 0.85, "HORMUZ",
                            "Strait of Hormuz closure (oil shock)"),
    "red_sea_crisis": Shock("chokepoint_closure", 0.8, "BAB_EL_MANDEB",
                            "Red Sea crisis — diversions via Cape of Good Hope"),
    "suez_blockage": Shock("chokepoint_closure", 0.9, "SUEZ",
                           "Suez Canal blockage"),
    "malacca_disruption": Shock("chokepoint_closure", 0.7, "MALACCA",
                                "Strait of Malacca disruption"),
    "panama_drought": Shock("chokepoint_closure", 0.5, "PANAMA",
                            "Panama Canal drought restrictions"),
}


@dataclass
class ScenarioResult:
    shock: Shock
    affected_ports: pd.DataFrame
    adjusted_forecast: pd.DataFrame
    oil_pct: float
    freight_pct: float
    briefing: str
    timeline: pd.DataFrame = field(default_factory=pd.DataFrame)


# ---------------------------------------------------------------------------
def _risk_level(p, hi):
    if p >= 60 or hi >= 75:
        return "High"
    if p >= 40 or hi >= 55:
        return "Medium"
    return "Low"


def simulate(shock: Shock, forecast: pd.DataFrame) -> ScenarioResult:
    """Apply a shock to a baseline/TFT forecast and quantify the impact."""
    mkt = market_impact(shock.shock_type, shock.chokepoint, shock.severity)

    # --- per-port impact table ------------------------------------------------
    rows = []
    impacts: Dict[str, object] = {}
    for pid in PORT_IDS:
        imp = port_impact(shock.shock_type, shock.chokepoint, shock.severity, pid)
        impacts[pid] = imp
        exposure = (port_exposure(pid).get(shock.chokepoint, 0.05)
                    if shock.chokepoint else 0.3)
        rows.append({
            PORT_ID: pid, "port_name": PORT_BY_ID[pid].name,
            "exposure": round(exposure, 2),
            "congestion_uplift": imp.congestion_uplift,
            "delay_factor": imp.delay_factor,
            "throughput_factor": imp.throughput_factor,
            "extra_steaming_days": imp.extra_steaming_days,
        })
    affected = (pd.DataFrame(rows)
                .sort_values("congestion_uplift", ascending=False)
                .reset_index(drop=True))

    # --- transform the forecast ----------------------------------------------
    adj = forecast.copy()
    if not adj.empty:
        def ap(row):
            imp = impacts.get(row[PORT_ID])
            if imp is None:
                return row
            up = imp.congestion_uplift
            for c in ("predicted_congestion", "q10", "q50", "q90"):
                if c in row and pd.notna(row[c]):
                    row[c] = float(np.clip(row[c] + up, 0, 100))
            if "predicted_delay" in row and pd.notna(row["predicted_delay"]):
                row["predicted_delay"] = float(row["predicted_delay"] * imp.delay_factor)
            if "predicted_throughput" in row and pd.notna(row["predicted_throughput"]):
                row["predicted_throughput"] = float(row["predicted_throughput"]
                                                    * imp.throughput_factor)
            return row
        adj = adj.apply(ap, axis=1)
        if {"predicted_congestion", "q90"} <= set(adj.columns):
            adj["risk_level"] = [_risk_level(p, h) for p, h in
                                 zip(adj["predicted_congestion"], adj["q90"])]
        adj["scenario"] = shock.title()

    briefing = _briefing(shock, affected, mkt)
    log.info("Scenario '%s': oil %+.1f%%, freight %+.1f%%; top port %s (+%.1f congestion).",
             shock.title(), mkt["oil_pct"], mkt["freight_pct"],
             affected.iloc[0][PORT_ID] if not affected.empty else "-",
             affected.iloc[0]["congestion_uplift"] if not affected.empty else 0)
    return ScenarioResult(shock, affected, adj, mkt["oil_pct"], mkt["freight_pct"],
                          briefing)


def _briefing(shock: Shock, affected: pd.DataFrame, mkt: dict) -> str:
    cp = CHOKEPOINTS.get(shock.chokepoint, {})
    reroute = cp.get("reroute_days", 0)
    top = affected.head(3)
    ports = ", ".join(f"{r[PORT_ID]} (+{r['congestion_uplift']:.0f})"
                      for _, r in top.iterrows())
    lines = [f"SCENARIO: {shock.title()} (severity {shock.severity:.0%}, "
             f"~{shock.duration_days} days)."]
    lines.append(f"Market impact: Brent {mkt['oil_pct']:+.1f}%, "
                 f"freight {mkt['freight_pct']:+.1f}%.")
    if reroute and not cp.get("no_alt"):
        lines.append(f"Vessels reroute via {CHOKEPOINTS.get('GOOD_HOPE',{}).get('name','an alternate route')}"
                     f" (~+{reroute} steaming days).")
    elif cp.get("no_alt"):
        lines.append("No maritime bypass exists — supply impact is immediate and "
                     "primarily a price shock.")
    lines.append(f"Most exposed ports: {ports}.")
    return " ".join(lines)


# ---------------------------------------------------------------------------
def detect_active_shocks(events: pd.DataFrame, min_severity: float = 0.6
                         ) -> List[Shock]:
    """Turn the live events feed into active shocks (dynamic prioritisation)."""
    if events is None or events.empty:
        return []
    hot = events[events["severity"] >= min_severity]
    shocks = []
    seen = set()
    for _, e in hot.iterrows():
        key = (e["shock_type"], e.get("chokepoint"))
        if key in seen:
            continue
        seen.add(key)
        shocks.append(Shock(shock_type=e["shock_type"],
                            severity=float(e["severity"]),
                            chokepoint=e.get("chokepoint"),
                            label=str(e.get("title", ""))[:80]))
    return shocks


def run_preset(name: str, forecast: pd.DataFrame) -> ScenarioResult:
    if name not in PRESETS:
        raise KeyError(f"Unknown scenario '{name}'. Options: {list(PRESETS)}")
    return simulate(PRESETS[name], forecast)
