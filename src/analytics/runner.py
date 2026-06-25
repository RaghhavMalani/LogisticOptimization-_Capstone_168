"""Run the full analytics suite and persist results to outputs/analytics/.

Inputs:
  india_data : {'traffic','commodity','trade'} from connectors.india_ports
  forecast   : the forecast table (for financial value-at-risk / demurrage)
Outputs (CSV + a JSON summary): KPIs, league table, coast comparison, anomalies,
cargo mix, demand index, trade balance, financial summary, national overview,
and the scenario backtest.
"""

from __future__ import annotations

import json
from typing import Dict, Optional

import pandas as pd

from src.utils.config import ANALYTICS_DIR
from src.utils.logging_utils import get_logger
from src.analytics import (kpis, benchmarking, anomaly, cargo, demand,
                           financial, india_overview, backtest)

log = get_logger(__name__)


def _write(df, name):
    if df is None or (hasattr(df, "empty") and df.empty):
        return
    ANALYTICS_DIR.mkdir(parents=True, exist_ok=True)
    df.to_csv(ANALYTICS_DIR / name, index=False)
    log.info("analytics: wrote %s (%d rows)", name, len(df))


def run_all(india_data: Dict[str, pd.DataFrame],
            forecast: Optional[pd.DataFrame] = None) -> Dict[str, object]:
    traffic = india_data.get("traffic", pd.DataFrame())
    commodity = india_data.get("commodity", pd.DataFrame())
    trade = india_data.get("trade", pd.DataFrame())

    results: Dict[str, object] = {}

    # --- operational KPIs + benchmarking -------------------------------------
    results["kpis"] = kpis.port_kpis(traffic);                _write(results["kpis"], "port_kpis.csv")
    results["seasonality"] = kpis.seasonality_strength(traffic); _write(results["seasonality"], "seasonality.csv")
    results["league"] = benchmarking.league_table(traffic);  _write(results["league"], "league_table.csv")
    results["coast"] = benchmarking.coast_comparison(traffic); _write(results["coast"], "coast_comparison.csv")
    results["anomalies"] = anomaly.detect_anomalies(traffic); _write(results["anomalies"], "anomalies.csv")

    # --- cargo / commodity ---------------------------------------------------
    results["commodity_mix"] = cargo.commodity_mix_by_port(commodity); _write(results["commodity_mix"], "commodity_mix_by_port.csv")
    results["national_commodity"] = cargo.national_commodity_mix(commodity); _write(results["national_commodity"], "national_commodity_mix.csv")
    results["cargo_type"] = cargo.cargo_type_split(commodity); _write(results["cargo_type"], "cargo_type_split.csv")

    # --- demand / trade ------------------------------------------------------
    results["demand"] = demand.demand_index_by_port(traffic, trade); _write(results["demand"], "demand_index.csv")
    results["trade_balance"] = demand.trade_balance(trade); _write(results["trade_balance"], "trade_balance.csv")

    # --- financial -----------------------------------------------------------
    if forecast is not None and not forecast.empty:
        results["financial"] = financial.financial_summary(traffic, trade, forecast)
        _write(results["financial"], "financial_summary.csv")
        results["value_at_risk"] = financial.value_at_risk(forecast, trade)
        _write(results["value_at_risk"], "value_at_risk.csv")
    results["revenue"] = financial.port_revenue(traffic); _write(results["revenue"], "port_revenue.csv")

    # --- national / business overview ---------------------------------------
    results["national_summary"] = india_overview.national_summary(traffic)
    results["top_ports"] = india_overview.top_ports(traffic); _write(results["top_ports"], "top_ports.csv")
    results["coast_split"] = india_overview.coast_split(traffic); _write(results["coast_split"], "coast_split.csv")

    # --- scenario backtest ---------------------------------------------------
    results["backtest"] = backtest.backtest_scenarios(); _write(results["backtest"], "scenario_backtest.csv")

    if results.get("national_summary"):
        with open(ANALYTICS_DIR / "national_summary.json", "w") as fh:
            json.dump(results["national_summary"], fh, indent=2, default=str)
        log.info("analytics: national summary %s", results["national_summary"])

    return results
