"""Shock -> impact model.

Translates a typed shock (with severity) into quantitative impacts:
  * market impact  : % change in oil (Brent) and freight rates,
  * port impact    : congestion uplift, delay multiplier, throughput multiplier,
                     and extra steaming days from rerouting.

The coefficients are first-order elasticities calibrated against real analogs
(documented inline), not fitted parameters -- this is a transparent,
explainable scenario model suitable for a decision-support / "terminal" tool.

Calibration anchors
-------------------
  * Ever Given / Suez block, Mar 2021 (~6 days): container freight +~25-35%,
    severe queueing.
  * Red Sea / Bab-el-Mandeb diversions, 2023-24: Asia-Europe spot freight
    +100-300%, ~+10-14 days via Cape of Good Hope.
  * Strait of Hormuz carries ~20% of global oil/LNG with no maritime bypass ->
    a closure is primarily an oil-price shock.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional

from src.ingestion.connectors.portwatch import CHOKEPOINTS, port_exposure

# Base impact at severity=1.0 and full exposure, per shock type.
SHOCK_BASE: Dict[str, dict] = {
    "chokepoint_closure": {"oil_pct": 0.15, "freight_pct": 0.45,
                           "congestion_uplift": 18.0, "delay_factor": 1.6,
                           "throughput_factor": 0.85},
    "conflict":          {"oil_pct": 0.10, "freight_pct": 0.18,
                          "congestion_uplift": 8.0, "delay_factor": 1.25,
                          "throughput_factor": 0.93},
    "sanctions":         {"oil_pct": 0.10, "freight_pct": 0.10,
                          "congestion_uplift": 5.0, "delay_factor": 1.12,
                          "throughput_factor": 0.96},
    "strike":            {"oil_pct": 0.0, "freight_pct": 0.08,
                          "congestion_uplift": 22.0, "delay_factor": 1.7,
                          "throughput_factor": 0.70},
    "weather_extreme":   {"oil_pct": 0.0, "freight_pct": 0.05,
                          "congestion_uplift": 12.0, "delay_factor": 1.3,
                          "throughput_factor": 0.85},
}

# How much each chokepoint's closure is an *oil* event (vs container/general).
_OIL_RELEVANCE = {"HORMUZ": 1.0, "BAB_EL_MANDEB": 0.5, "SUEZ": 0.4,
                  "MALACCA": 0.4, "PANAMA": 0.15, "GOOD_HOPE": 0.1}


@dataclass
class Impact:
    oil_pct: float
    freight_pct: float
    congestion_uplift: float
    delay_factor: float
    throughput_factor: float
    extra_steaming_days: float


def _base(shock_type: str) -> dict:
    return SHOCK_BASE.get(shock_type, SHOCK_BASE["conflict"])


def market_impact(shock_type: str, chokepoint: Optional[str], severity: float
                  ) -> Dict[str, float]:
    b = _base(shock_type)
    oil_rel = _OIL_RELEVANCE.get(chokepoint, 0.2) if chokepoint else 0.2
    reroute = CHOKEPOINTS.get(chokepoint, {}).get("reroute_days", 0) if chokepoint else 0
    oil = b["oil_pct"] * severity * oil_rel
    # Hormuz has no bypass -> amplify the oil shock.
    if chokepoint == "HORMUZ":
        oil *= 1.6
    freight = b["freight_pct"] * severity * (1 + reroute / 12.0)
    return {"oil_pct": round(oil * 100, 1), "freight_pct": round(freight * 100, 1)}


def port_impact(shock_type: str, chokepoint: Optional[str], severity: float,
                port_id: str) -> Impact:
    b = _base(shock_type)
    if chokepoint:
        exposure = port_exposure(port_id).get(chokepoint, 0.05)
        reroute = CHOKEPOINTS.get(chokepoint, {}).get("reroute_days", 0)
    else:
        exposure = 0.3      # generic shock affects all ports moderately
        reroute = 0
    e = severity * exposure
    mkt = market_impact(shock_type, chokepoint, severity)
    return Impact(
        oil_pct=mkt["oil_pct"],
        freight_pct=mkt["freight_pct"],
        congestion_uplift=round(b["congestion_uplift"] * e, 2),
        delay_factor=round(1 + (b["delay_factor"] - 1) * e, 3),
        throughput_factor=round(1 - (1 - b["throughput_factor"]) * e, 3),
        extra_steaming_days=round(reroute * e, 1),
    )
