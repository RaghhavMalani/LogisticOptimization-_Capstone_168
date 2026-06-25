"""Scenario-engine backtest against real historical disruptions.

Validates the impact model by comparing its predicted freight/oil moves and
reroute days to *observed* effects of well-documented events. This is the
"is the model believable?" evidence a reviewer will ask for.

Observed ranges are from public reporting (approximate, for validation only):
  * Ever Given / Suez block (Mar 2021): Asia-Europe spot freight +~25-35%,
    canal fully blocked ~6 days.
  * Red Sea / Bab-el-Mandeb diversions (2023-24): spot freight +~150-250%,
    ~+12-14 days via Cape of Good Hope.
  * Panama Canal drought (2023-24): transit cut via draft limits; freight +~10-20%.
"""

from __future__ import annotations

import pandas as pd

from src.decision.impact_model import market_impact
from src.ingestion.connectors.portwatch import CHOKEPOINTS

# (label, chokepoint, severity, observed_freight_low, _high, observed_reroute_days)
_ANALOGS = [
    ("Ever Given / Suez block 2021", "SUEZ", 0.9, 25, 35, 0),
    ("Red Sea diversions 2023-24", "BAB_EL_MANDEB", 0.8, 150, 250, 12),
    ("Panama drought 2023-24", "PANAMA", 0.5, 10, 20, 8),
]


def backtest_scenarios() -> pd.DataFrame:
    rows = []
    for label, cp, sev, lo, hi, obs_days in _ANALOGS:
        m = market_impact("chokepoint_closure", cp, sev)
        model_days = CHOKEPOINTS.get(cp, {}).get("reroute_days", 0)
        within = lo <= m["freight_pct"] <= hi
        rows.append({
            "event": label, "chokepoint": cp, "severity": sev,
            "model_freight_pct": m["freight_pct"],
            "observed_freight_pct_range": f"{lo}-{hi}",
            "freight_in_range": within,
            "model_oil_pct": m["oil_pct"],
            "model_reroute_days": model_days,
            "observed_reroute_days": obs_days,
        })
    return pd.DataFrame(rows)
