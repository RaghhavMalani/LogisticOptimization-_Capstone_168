"""End-to-end demo runner for the India Maritime Logistics Forecasting System.

Pipeline
--------
    load sample/raw data
        -> weather / news / port-AIS-proxy / trade experts
        -> merge expert features into one panel
        -> HSMM regime model
        -> TFT (core) or baseline forecast  [--model]
        -> decision layer + route optimization
        -> walk-forward evaluation
        -> port- & ship-manager outputs
   (optional) -> benchmark, explainability, DB storage, streaming replay

Usage
-----
    python run_demo.py                       # auto data, auto model (TFT if torch)
    python run_demo.py --model baseline      # force the fast quantile baseline
    python run_demo.py --model tft --epochs 40
    python run_demo.py --source sample       # synthetic multi-port data
    python run_demo.py --benchmark --explain # model comparison + feature importance
    python run_demo.py --store               # persist to Postgres/SQLite
    python run_demo.py --stream              # run the Kafka/in-memory streaming demo
    python run_demo.py --no-eval             # skip walk-forward (faster)

Artefacts are written under outputs/{expert_features,regimes,forecasts}/.
"""

from __future__ import annotations

import argparse
import json

import pandas as pd

from src.utils.config import (
    ANALYTICS_DIR,
    DATE,
    DemoConfig,
    EXPERT_FEATURES_DIR,
    FORECASTS_DIR,
    FORECAST_HORIZON_DAYS,
    PORT_ID,
    REGIMES_DIR,
    ensure_dirs,
)
from src.utils.logging_utils import get_logger, section
from src.ingestion.load_data import load_raw_bundle
from src.ingestion.validation import validate_bundle
from src.ingestion.sample_data import write_sample_data
from src.experts import (weather_expert, news_expert, port_ops_expert,
                         trade_demand_expert)
from src.regimes.regime_features import assemble_panel
from src.regimes.hsmm_model import HSMMRegimeModel
from src.forecasting.forecast_runner import generate_forecast
from src.evaluation.walk_forward import walk_forward_validate
from src.decision.decision_layer import build_decisions, high_risk_calendar
from src.decision.route_optimizer import optimize_fleet
from src.dashboard.user_outputs import (build_port_manager_report,
                                        build_ship_manager_report,
                                        render_text_briefing)

log = get_logger("run_demo")


def main():
    p = argparse.ArgumentParser(description="Run the logistics forecast demo.")
    p.add_argument("--source", default="auto", choices=["auto", "sample", "real"])
    p.add_argument("--model", default="auto", choices=["auto", "tft", "baseline"])
    p.add_argument("--epochs", type=int, default=40, help="TFT max epochs")
    p.add_argument("--horizon", type=int, default=FORECAST_HORIZON_DAYS)
    p.add_argument("--days", type=int, default=240, help="synthetic sample length")
    p.add_argument("--no-eval", action="store_true")
    p.add_argument("--benchmark", action="store_true", help="compare models")
    p.add_argument("--explain", action="store_true", help="feature importance")
    p.add_argument("--store", action="store_true", help="persist to DB")
    p.add_argument("--stream", action="store_true", help="run streaming replay")
    p.add_argument("--scenario", default=None,
                   help="event-shock scenario: a preset name (hormuz_closure, "
                        "red_sea_crisis, suez_blockage, malacca_disruption, "
                        "panama_drought) or 'auto' to detect from live events")
    p.add_argument("--analytics", action="store_true",
                   help="run the India port analytics suite (KPIs, benchmarking, "
                        "cargo/demand/financial, national overview)")
    p.add_argument("--web", action="store_true",
                   help="build data.json for the next-gen web app (src/webapp)")
    args = p.parse_args()

    ensure_dirs()
    cfg = DemoConfig(n_days=args.days, horizon=args.horizon)

    # ------------------------------------------------------------------ data
    section(log, "STEP 1  Load & validate raw data")
    if args.source in ("sample", "auto"):
        try:
            write_sample_data(cfg)
        except Exception as exc:  # pragma: no cover
            log.warning("Could not persist sample data: %s", exc)
    bundle = load_raw_bundle(source=args.source, cfg=cfg)
    validate_bundle(bundle)
    observed = bundle["observed"]

    # --------------------------------------------------------------- experts
    section(log, "STEP 2  Run expert modules")
    weather_now = weather_expert.run(bundle["weather_raw"])
    news_feats = news_expert.run(bundle["news_raw"])
    port_ops_feats = port_ops_expert.run(bundle["port_ops_raw"], observed=observed)
    trade_feats = trade_demand_expert.run(bundle["trade_raw"],
                                          observed[[PORT_ID, DATE]].copy())
    # macro / conditions expert (oil, USD/INR, inflation, live news) -> HSMM
    macro_feats = None
    try:
        from src.ingestion.connectors import macro as macro_conn, events as events_conn
        from src.experts import macro_expert
        macro_raw = macro_conn.fetch_macro_conditions(days=2000)
        macro_feats = macro_expert.run(macro_raw, events_conn.fetch_events())
        macro_feats = _align_macro(macro_feats, observed)
    except Exception as exc:  # pragma: no cover
        log.warning("Macro expert skipped: %s", exc)
    _write(weather_now, EXPERT_FEATURES_DIR / "weather_features.csv")
    _write(news_feats, EXPERT_FEATURES_DIR / "news_features.csv")
    _write(port_ops_feats, EXPERT_FEATURES_DIR / "port_ops_features.csv")
    _write(trade_feats, EXPERT_FEATURES_DIR / "trade_demand_features.csv")
    if macro_feats is not None:
        _write(macro_feats, EXPERT_FEATURES_DIR / "macro_features.csv")

    # ----------------------------------------------------------------- panel
    section(log, "STEP 3  Assemble feature panel")
    panel = assemble_panel(observed, weather_now, news_feats, port_ops_feats,
                           trade_feats, macro=macro_feats)
    _write(panel, EXPERT_FEATURES_DIR / "merged_panel.csv")

    # ----------------------------------------------------------------- HSMM
    section(log, "STEP 4  HSMM regime inference")
    regimes = HSMMRegimeModel(seed=cfg.seed).fit_predict(panel)
    _write(regimes, REGIMES_DIR / "regimes.csv")
    log.info("Regime distribution: %s",
             regimes["regime_label"].value_counts(normalize=True).round(3).to_dict())
    reg_cols = ["p_normal", "p_congested", "p_severe", "days_in_state",
                "expected_remaining_days", "transition_risk", "regime_confidence"]
    panel_fc = panel.merge(
        regimes[[PORT_ID, DATE] + reg_cols].drop_duplicates([PORT_ID, DATE]),
        on=[PORT_ID, DATE], how="left")

    # ----------------------------------------------------------- forecasting
    section(log, f"STEP 5  Forecast (model={args.model})")
    forecast = generate_forecast(panel_fc, weather_now, horizon=args.horizon,
                                 model=args.model, tft_max_epochs=args.epochs)
    _write(forecast, FORECASTS_DIR / "forecast_table.csv")

    # ------------------------------------------------------ decision + routes
    section(log, "STEP 6  Decision layer + route optimization")
    decisions = build_decisions(forecast, weather_now)
    _write(decisions, FORECASTS_DIR / "decisions.csv")
    _write(high_risk_calendar(decisions), FORECASTS_DIR / "high_risk_dates.csv")
    routes = optimize_fleet(forecast)
    _write(routes, FORECASTS_DIR / "route_recommendations.csv")
    for _, r in routes.iterrows():
        log.info("[route] %s", r["recommendation"])

    # ----------------------------------------------------------- evaluation
    if not args.no_eval:
        section(log, "STEP 7  Walk-forward validation")
        try:
            wf = walk_forward_validate(panel_fc, weather_now,
                                       horizon=args.horizon, n_folds=4)
            _write(wf.fold_metrics, FORECASTS_DIR / "walk_forward_metrics.csv")
            with open(FORECASTS_DIR / "walk_forward_overall.json", "w") as fh:
                json.dump(wf.overall, fh, indent=2, default=str)
            log.info("Walk-forward overall: %s", wf.overall)
        except Exception as exc:  # pragma: no cover
            log.warning("Walk-forward skipped: %s", exc)

    # ------------------------------------------------------------ benchmark
    if args.benchmark:
        section(log, "STEP 8  Model benchmark")
        from src.evaluation.benchmark import compare_models
        try:
            compare_models(panel_fc, weather_now, horizon=args.horizon,
                           include_tft=(args.model in ("auto", "tft")))
        except Exception as exc:  # pragma: no cover
            log.warning("Benchmark skipped: %s", exc)

    if args.explain:
        section(log, "STEP 8b  Explainability")
        from src.evaluation.explainability import baseline_feature_importance
        try:
            baseline_feature_importance(panel_fc, weather_now, horizon=args.horizon)
        except Exception as exc:  # pragma: no cover
            log.warning("Explainability skipped: %s", exc)

    # ---------------------------------------------------------- user outputs
    section(log, "STEP 9  Port- & ship-manager outputs")
    port_report = build_port_manager_report(forecast, regimes, weather_now)
    ship_report = build_ship_manager_report(forecast, regimes, weather_now)
    _write(port_report["table"], FORECASTS_DIR / "port_manager_report.csv")
    _write(ship_report["table"], FORECASTS_DIR / "ship_manager_report.csv")
    briefing = render_text_briefing(port_report, ship_report)
    with open(FORECASTS_DIR / "briefing.txt", "w", encoding="utf-8") as fh:
        fh.write(briefing)

    # ----------------------------------------------- terminal data + scenarios
    section(log, "STEP 9b  Terminal data (chokepoints, markets, events)")
    try:
        from src.ingestion.connectors import portwatch, markets, events as ev
        chokepoints = portwatch.fetch_chokepoint_status()
        brent = markets.fetch_brent()
        freight = markets.fetch_freight_index()
        event_feed = ev.fetch_events()
        _write(chokepoints, FORECASTS_DIR / "chokepoints.csv")
        _write(brent, FORECASTS_DIR / "market_brent.csv")
        _write(freight, FORECASTS_DIR / "market_freight.csv")
        _write(event_feed, FORECASTS_DIR / "events.csv")
    except Exception as exc:  # pragma: no cover
        log.warning("Terminal data step skipped: %s", exc)
        event_feed = None

    scenario_result = None
    if args.scenario:
        section(log, f"STEP 9c  Event-shock scenario ({args.scenario})")
        try:
            from src.decision import scenario_engine as se
            if args.scenario == "auto":
                shocks = se.detect_active_shocks(event_feed) if event_feed is not None else []
                if shocks:
                    scenario_result = se.simulate(shocks[0], forecast)
                else:
                    log.info("No active shocks detected above threshold.")
            else:
                scenario_result = se.run_preset(args.scenario, forecast)
            if scenario_result is not None:
                _write(scenario_result.affected_ports,
                       FORECASTS_DIR / "scenario_affected_ports.csv")
                _write(scenario_result.adjusted_forecast,
                       FORECASTS_DIR / "scenario_adjusted_forecast.csv")
                with open(FORECASTS_DIR / "scenario_briefing.txt", "w",
                          encoding="utf-8") as fh:
                    fh.write(scenario_result.briefing)
                log.info("[scenario] %s", scenario_result.briefing)
        except Exception as exc:  # pragma: no cover
            log.warning("Scenario step skipped: %s", exc)

    # ------------------------------------------------- India port analytics
    if args.analytics:
        section(log, "STEP 9d  India port analytics (financial / cargo / demand)")
        try:
            from src.ingestion.connectors import india_ports
            from src.analytics import runner as analytics_runner
            india_data = india_ports.fetch_india_port_traffic()
            _write(india_data["traffic"], ANALYTICS_DIR / "india_traffic.csv")
            _write(india_data["commodity"], ANALYTICS_DIR / "india_commodity.csv")
            _write(india_data["trade"], ANALYTICS_DIR / "india_trade.csv")
            analytics_runner.run_all(india_data, forecast)
        except Exception as exc:  # pragma: no cover
            log.warning("Analytics step skipped: %s", exc)

    # -------------------------------------------------------------- storage
    if args.store:
        section(log, "STEP 10  Persist to database")
        try:
            from src.storage.db import get_engine, persist_pipeline
            engine = get_engine()
            persist_pipeline(
                engine, bundle=bundle,
                experts={"weather": weather_now, "news": news_feats,
                         "port_ops": port_ops_feats, "trade": trade_feats},
                panel=panel_fc, regimes=regimes, forecast=forecast,
                decisions=decisions, routes=routes)
        except Exception as exc:  # pragma: no cover
            log.warning("Storage skipped: %s", exc)

    # ------------------------------------------------------------ streaming
    if args.stream:
        section(log, "STEP 11  Streaming replay (real-time path)")
        try:
            from src.streaming.consumer import run_streaming_demo
            run_streaming_demo(bundle, horizon=args.horizon,
                               warmup_days=60, refresh_every=30)
        except Exception as exc:  # pragma: no cover
            log.warning("Streaming skipped: %s", exc)

    # --------------------------------------------------------- web app data
    if args.web:
        section(log, "Build web app data (src/webapp/data.json)")
        try:
            from src.webapp import build_data
            build_data.generate()
            log.info("Web app ready: python -m src.webapp.serve  ->  localhost:8000")
        except Exception as exc:  # pragma: no cover
            log.warning("Web data build skipped: %s", exc)

    # ------------------------------------------------------ data provenance
    try:
        from src.utils import provenance
        provenance.record("Port observed series",
                          provenance.LIVE if args.source == "real"
                          else provenance.SYNTHETIC,
                          "DGQI/real" if args.source == "real" else "synthetic sample")
        provenance.save()
        log.info("Data readiness: %.0f%% of sources live/cached.",
                 provenance.readiness_score() * 100)
    except Exception as exc:  # pragma: no cover
        log.warning("Provenance save skipped: %s", exc)

    # --------------------------------------------------------------- summary
    section(log, "DONE")
    print("\n" + briefing + "\n")
    log.info("Artefacts under: %s  (expert_features/ regimes/ forecasts/)",
             FORECASTS_DIR.parent)
    log.info("Dashboard: streamlit run src/dashboard/app.py")
    return {"forecast": forecast, "regimes": regimes, "decisions": decisions,
            "routes": routes}


def _align_macro(macro_feats, observed):
    """Align the national macro series onto the data window's dates.

    If the macro dates already overlap the observed dates (real FRED history vs
    real port dates), the natural date-merge is used. Otherwise (e.g. synthetic
    macro dated 'today' vs a 2022 sample) we overlay the most recent macro window
    onto the observed dates so the conditions still vary across the panel.
    """
    if macro_feats is None or macro_feats.empty:
        return macro_feats
    mf = macro_feats.copy()
    mf["date"] = pd.to_datetime(mf["date"])
    obs_dates = sorted(pd.to_datetime(observed[DATE]).dropna().unique())
    overlap = set(mf["date"]).intersection(obs_dates)
    if len(overlap) >= max(5, 0.3 * len(obs_dates)):
        return mf
    mf = mf.sort_values("date")
    n = min(len(mf), len(obs_dates))
    mf = mf.tail(n).copy()
    mf["date"] = list(obs_dates[-n:])
    return mf


def _write(df: pd.DataFrame, path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)
    log.info("wrote %s (%d rows)", path.name, len(df))


if __name__ == "__main__":
    main()
