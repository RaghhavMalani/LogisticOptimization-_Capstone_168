# India PortWatch — Predictive Port Intelligence

> An India-centric, **predictive** counterpart to IMF PortWatch: where PortWatch
> *monitors* and *simulates*, India PortWatch also **forecasts** (per-port,
> 1–10 days), infers operational **regimes**, recommends **operational + routing
> decisions**, runs **event-shock scenarios**, and adds a deep **analytics**
> layer (financial / cargo / demand / business — India-wide and port-wise).

A modular system that forecasts the operational situation at major Indian
ports **up to 10 days ahead** — congestion, delay, throughput, the current
operational regime, and the associated risk and confidence — then turns that
into decisions, scenarios, and analytics.

The system is **not a single model**. Raw, messy sources are first cleaned by
small *expert modules* into structured numerical features. Those features feed a
*Hidden Semi-Markov Model (HSMM)* that infers the operational regime and how long
it is likely to last. Finally, the expert features, regime outputs and
future-known covariates are passed into a *Temporal Fusion Transformer (TFT)* —
the intended core model — to produce 1–10 day quantile forecasts for two
audiences: **port managers** and **ship managers**.

```
Raw Data ─▶ Expert Modules ─▶ HSMM Regime Model ─▶ TFT Forecasting ─▶ Port & Ship Manager Outputs
```

> **Phase 3 status.** This repo upgrades the earlier notebook-only work into a
> clean `src/` package with a runnable end-to-end demo and the full architecture
> from the design diagram: expert modules, an HSMM regime model, a **real
> trainable Temporal Fusion Transformer** (with a leakage-safe gradient-boosted
> quantile baseline as automatic fallback), a **decision + route-optimization
> layer**, a **storage layer** (PostgreSQL / SQLite), a **streaming path**
> (Kafka / in-memory), model **benchmarking + explainability**, and an
> interactive **Streamlit dashboard**. Every heavy dependency degrades
> gracefully, so the system runs with zero infrastructure and scales up to the
> full stack when you want it.

---

## 1. Architecture

| Stage | Module(s) | What it does |
|-------|-----------|--------------|
| Ingestion | `src/ingestion/` | Loads raw/sample data, validates it, generates a synthetic multi-port dataset as a fallback. |
| Experts | `src/experts/` | Four modules turn weather, news, AIS-proxy and trade data into clean `(port_id, date)` features + confidence. |
| Regimes | `src/regimes/` | Assembles a feature panel and infers `NORMAL / CONGESTED / SEVERE` regimes with duration estimates (HSMM). |
| Forecasting | `src/forecasting/` | TFT-ready dataset builder, the **real TFT** (`tft_model.py`), and the quantile baseline. `generate_forecast()` selects TFT or baseline with auto-fallback. |
| Connectors | `src/ingestion/connectors/` | Live external data with offline cache+fallback: IMF PortWatch (chokepoints), FRED/EIA (oil), freight index, GDELT (events), **data.gov.in/Sagar Unnati/DGCIS** (India major-port traffic). |
| Analytics | `src/analytics/` | Port-wise + India-wide analytics: KPIs, league table/efficiency, anomaly detection, cargo & commodity mix, demand, **financial value-at-risk/demurrage**, national overview, scenario backtest. |
| Decision | `src/decision/` | Decision layer + route optimizer + **event-shock scenario engine** (impact model + geo-causal propagation; what-if shocks like a Hormuz/Suez/Red-Sea closure). |
| Evaluation | `src/evaluation/` | Walk-forward validation, metrics, model **benchmarking**, and **explainability** (permutation + TFT variable selection). |
| Storage | `src/storage/` | SQLAlchemy persistence — PostgreSQL via `DATABASE_URL`, automatic SQLite fallback. |
| Streaming | `src/streaming/` | Kafka producer/consumer for the real-time path, with an in-memory bus fallback. |
| Dashboard | `src/dashboard/` | Port/ship-manager reports + an interactive Plotly/Streamlit app (map, gauges, bands, regimes, routes, benchmark). |
| Utils | `src/utils/` | Central config (ports, paths, regimes) and logging. |

The defining engineering rule throughout: **no feature for a past forecast date
ever uses future data.** Lags/rollings look strictly backward, event risk decays
forward in time only, monthly trade values respect a publication lag, and
training labels in validation must be observed by the fold cutoff.

---

## 2. Folder structure

```
LogisticOptimization-_Capstone_168/
├── run_demo.py                 # ◀ one-command end-to-end demo (with flags)
├── docker-compose.yml          # PostgreSQL + Kafka + Zookeeper
├── requirements.txt            # lightweight core deps
├── requirements-extras.txt     # dashboard + storage + streaming + plots
├── requirements-tft.txt        # deep-learning TFT stack (torch)
├── README.md
│
├── data/
│   ├── raw/  processed/  sample/   # sample = synthetic multi-port (auto-generated)
│   └── preprocessed/               # original shipped CSVs (weather/news/economic/DGQI)
│
├── src/
│   ├── ingestion/   load_data.py · validation.py · sample_data.py
│   ├── experts/     weather_expert.py · news_expert.py · port_ops_expert.py · trade_demand_expert.py · base.py
│   ├── regimes/     regime_features.py · hsmm_model.py
│   ├── forecasting/ tft_dataset.py · tft_model.py · forecast_runner.py
│   ├── decision/    decision_layer.py · route_optimizer.py
│   ├── evaluation/  walk_forward.py · metrics.py · benchmark.py · explainability.py
│   ├── storage/     db.py
│   ├── streaming/   bus.py · producer.py · consumer.py
│   ├── dashboard/   user_outputs.py · app.py
│   └── utils/       config.py · logging_utils.py
│
├── features/                   # original exploratory notebooks (preserved)
│
└── outputs/
    ├── expert_features/        # per-expert feature tables + merged panel
    ├── regimes/                # regime labels + probabilities + durations
    ├── forecasts/              # forecasts, decisions, routes, metrics, benchmark, reports
    └── logistics.db            # SQLite store (default; or Postgres via DATABASE_URL)
```

---

## 3. Setup

```bash
python -m venv .venv && source .venv/bin/activate      # (Windows: .venv\Scripts\activate)
pip install -r requirements.txt          # core: pipeline + baseline forecaster
pip install -r requirements-extras.txt   # dashboard + storage + streaming + plots
pip install -r requirements-tft.txt      # real Temporal Fusion Transformer (torch)
```

The core install alone runs the whole pipeline (with the baseline forecaster and
an in-memory bus + SQLite). Install the extras/TFT stacks to unlock the
dashboard, real Postgres/Kafka, and the trained TFT. Optional: `hmmlearn` gives a
true GaussianHMM (otherwise a GaussianMixture is used).

To bring up the production infrastructure (optional):

```bash
docker compose up -d
# PowerShell:
$env:DATABASE_URL = "postgresql+psycopg2://logistics:logistics@localhost:5432/logistics"
$env:KAFKA_BOOTSTRAP_SERVERS = "localhost:9092"
```

---

## 4. How to run the demo

```bash
python run_demo.py                       # auto data + auto model (TFT if torch, else baseline)
python run_demo.py --source portwatch    # REAL IMF PortWatch satellite-AIS data (12 Indian ports)
python run_demo.py --refresh-portwatch --source portwatch   # re-fetch live PortWatch first
python run_demo.py --source sample       # synthetic multi-port data (fully controllable)
python run_demo.py --model baseline      # force the fast quantile baseline
python run_demo.py --model tft --epochs 40   # force/train the real TFT
python run_demo.py --benchmark --explain # model comparison + feature importance + plots
python run_demo.py --store               # persist every stage to Postgres/SQLite
python run_demo.py --stream              # run the Kafka / in-memory streaming replay
python run_demo.py --no-eval             # skip walk-forward validation (faster)
python run_demo.py --scenario hormuz_closure   # simulate a Strait of Hormuz shock
python run_demo.py --scenario auto       # auto-detect active shocks from live events
python run_demo.py --analytics           # India port analytics (KPIs, financial, cargo, demand)
```

Scenario presets: `hormuz_closure`, `red_sea_crisis`, `suez_blockage`,
`malacca_disruption`, `panama_drought`. The Terminal tab in the dashboard also
runs these interactively (with a before/after forecast chart and a live 3D port
view).

Flags compose, e.g. a full showcase run:

```bash
python run_demo.py --source sample --model tft --benchmark --explain --store
streamlit run src/dashboard/app.py       # interactive dashboard (map, gauges, routes, benchmark)
```

All artefacts are written under `outputs/`, and a text briefing prints to the
console.

---

## 5. The model pipeline in detail

**Expert modules** (`src/experts/`). Each consumes one raw source and emits a
small, leakage-safe feature table keyed by `(port_id, date)` plus a per-row
confidence score that drops when inputs are missing:

- **Weather** → `wind_risk, rain_risk, wave_risk, storm_risk, weather_confidence`
  and a composite **`WxImpactIndex` (0–1)** (0–0.3 low · 0.3–0.6 moderate · 0.6–1
  high). Also exposes `build_future_known()` so the next 10 days of weather are
  available to the TFT as **future-known covariates**.
- **News / Geopolitical** → `news_sentiment_score, geo_risk_score, strike_risk,
  policy_risk, conflict_risk, event_spike_score, news_confidence`. Event risk
  decays forward in time from the event date only (backward-looking).
- **Port Ops / AIS proxy** → `vessel_density, avg_speed_near_port,
  anchorage_count, arrival_count, departure_count, queue_proxy, turnaround_proxy,
  ais_confidence`. **Falls back** to congestion-derived proxies (with low
  `ais_confidence`) when no real AIS is available.
- **Trade / Demand** → `demand_index, demand_pressure, trade_trend,
  demand_confidence`. Monthly data is made daily with **time-aware** methods:
  interpolation for smooth indices, forward-fill for conditions, even
  distribution for volume totals, all behind a publication lag.

**HSMM regime model** (`src/regimes/hsmm_model.py`). The expert + ops features
are clustered into three latent states (GaussianHMM via `hmmlearn` if installed,
otherwise a scikit-learn GaussianMixture). States are mapped to
`NORMAL / CONGESTED / SEVERE` by ascending mean congestion, then post-processed
to add the semi-Markov *duration* information: `days_in_state`,
`expected_remaining_days` (blended geometric self-transition + empirical dwell),
and `transition_risk` (probability of escalating to a more severe regime).
Outputs include per-state probabilities and a `regime_confidence`.

**Forecasting** (`src/forecasting/`). `tft_dataset.py` builds the supervised /
inference matrices and the column-role metadata a `TimeSeriesDataSet` needs.
`tft_model.py` is the **TFT scaffold** with a clearly-marked `TODO(tft)` plug-in
point. `forecast_runner.py` is the always-available **quantile baseline**: direct
multi-horizon gradient-boosted regressors produce `q10/q50/q90` for the primary
target (congestion) and point forecasts for delay/throughput, then package
everything — with `risk_level` and `confidence_score` — into the final forecast
table.

**Decision + route optimization** (`src/decision/`). The decision layer reads a
congestion *probability* off the quantile forecast (a piecewise-linear CDF over
q10/q50/q90), combines it with delay and weather into ETA / berth / entry risk,
and emits operational adjustments and a priority score per port/horizon. The
route optimizer scores each candidate port-call by expected delay + congestion
probability + a great-circle diversion penalty, then recommends the best arrival
day, an ETA buffer, and reroute alternatives for a fleet of vessels.

**Evaluation** (`src/evaluation/`). Expanding-window walk-forward validation
(e.g. train 1–60 → forecast 61–70, train 1–70 → forecast 71–80, …) with MAE /
RMSE / MAPE, pinball loss, 80% interval coverage, and regime distribution /
duration statistics. `benchmark.py` compares **TFT vs baseline vs naive
persistence** on identical folds (with plots); `explainability.py` reports
permutation feature importance and the TFT's learned variable selection.

**Event-driven scenario engine** (`src/decision/scenario_engine.py`,
`impact_model.py`, `src/ingestion/connectors/`). Connectors pull real
chokepoint data (IMF PortWatch), oil prices (FRED/EIA), a freight index, and
geopolitical events (GDELT) — each with an offline cache + synthetic fallback so
the demo always runs. The scenario engine takes a typed shock (e.g. a Strait of
Hormuz closure), walks a geo-causal graph (chokepoint → exposed ports →
commodities), and uses an elasticity-based impact model (calibrated to real
analogs: Ever Given/Suez 2021, Red Sea 2023-24) to produce a **shock-adjusted
forecast** plus market impact (Brent %, freight %). It can run preset what-ifs or
auto-detect active shocks from the live event feed — the "prioritise events over
weather" behaviour. A Bloomberg-style **Terminal** tab surfaces chokepoint
status, commodity tickers, a geopolitical alert feed, scenario buttons, and a
live 3D port view.

**Storage + streaming** (`src/storage/`, `src/streaming/`). The storage layer
persists every stage (raw → experts → panel → regimes → forecasts → decisions →
routes) to PostgreSQL when `DATABASE_URL` is set, otherwise to a local SQLite
file. The streaming layer replays the data day-by-day onto a Kafka topic (or an
in-memory bus) and re-runs experts → HSMM → forecast → decision as new records
arrive, mirroring the diagram's real-time loop.

---

## 6. Example outputs

**Forecast table** (`outputs/forecasts/forecast_table.csv`):

| port_id | forecast_origin_date | target_date | horizon_day | predicted_congestion | predicted_delay | predicted_throughput | q10 | q50 | q90 | risk_level | confidence_score |
|---------|----------------------|-------------|-------------|----------------------|-----------------|----------------------|-----|-----|-----|------------|------------------|
| JNPT | 2022-08-27 | 2022-08-31 | 4 | 58.2 | 37.1 | 985.0 | 41.0 | 58.2 | 78.6 | Medium | 0.71 |

**Regimes** (`outputs/regimes/regimes.csv`):

| port_id | date | regime_label | p_normal | p_congested | p_severe | days_in_state | expected_remaining_days | transition_risk | regime_confidence |
|---------|------|--------------|----------|-------------|----------|---------------|-------------------------|-----------------|-------------------|
| JNPT | 2022-08-27 | CONGESTED | 0.18 | 0.67 | 0.15 | 3 | 4.0 | 0.22 | 0.67 |

**Port-manager briefing** (`outputs/forecasts/briefing.txt`):

> JNPT is expected to remain in CONGESTED state for ~4 day(s). P90
> delay/congestion risk exceeds threshold on Day +4. Weather impact is moderate;
> capacity risk is high (peak congestion ~58, P90 ~79).

**Ship-manager briefing:**

> For vessels arriving at Chennai in the next 5 days, berth waiting risk is high.
> Recommended buffer: 18–24 hours. Confidence: medium.

(Exact numbers depend on the data source; the synthetic sample is reproducible
via the fixed seed in `src/utils/config.py`.)

---

## 7. Limitations (especially AIS)

- **AIS is now partially solved via IMF PortWatch.** `--source portwatch` feeds
  real satellite-AIS-derived daily port calls + import/export tonnes for 12
  Indian ports (Port-Ops expert PORTWATCH mode, `ais_confidence` 0.75). What is
  still a proxy: `congestion_index` is a call-pressure index and `delay_hours`
  is derived from it, because no public feed reports measured berth delays --
  wiring port-authority dwell data (Sagar Setu / DGQI) is the fix. Raw vessel
  tracks (GEE Sentinel-1 or commercial AIS) would raise confidence to 0.9.
  The full API catalogue lives in `docs/DATA_SOURCES.md`.
- **The shipped CSVs are national, not port-level** (except DGQI dwell times).
  In `--source real` mode the national weather/news/economic series are
  broadcast across ports, so cross-port differences come mainly from DGQI and
  the static port attributes. The synthetic sample is what exercises the full
  port-level behaviour.
- **The TFT now trains for real** (`--model tft`, needs `requirements-tft.txt`).
  The gradient-boosted baseline remains the always-available fallback and the
  benchmark floor. On the monthly-dwell *real* data the TFT's advantage is muted
  (little daily signal); its strengths show on the synthetic sample and will show
  on true daily port-level data.
- **Static port attributes** (capacity, berth count, connectivity) are
  illustrative prototype values, not official figures.

---

## 8. Next steps for Phase 3

0. **Extend the PortWatch history.** The cache ships ~4 months x 8 major ports;
   run `python -m app.data.portwatch` (pagination bug now fixed) to pull a year+
   for all 16 mapped ports, which materially helps the TFT and the HSMM
   duration estimates.

1. **Satellite AIS proxy.** Implement a Google Earth Engine ingestion path
   (vessel/anchorage detections) and feed it into `port_ops_expert` as a real —
   not synthesised — source, raising `ais_confidence`.
2. **Scale the TFT.** The TFT is implemented and trainable (`--model tft`). Next:
   tune it (hidden size, attention heads, encoder length), add multi-target
   output (delay + throughput in one model), and benchmark on true daily data.
3. **Real port-level targets.** Source genuine per-port congestion/delay series
   (port authority feeds, DGQI at higher frequency) to replace the synthetic
   targets.
4. **Calibrated regimes.** Add explicit HSMM duration distributions and validate
   regime labels against any available ground truth (confusion matrix support is
   already in `evaluation/metrics.py`).
5. **Operationalise outputs.** Wire the manager reports into a scheduled daily
   refresh and the Streamlit dashboard / alerting.

---

## In one paragraph

This system uses **expert modules** to transform raw logistics, weather, news,
trade and port signals into structured numerical features. These features are
passed into an **HSMM** to infer operational regimes and their expected duration.
The HSMM outputs, expert features and future-known covariates are then passed
into a **TFT** forecasting model to produce 1–10 day forecasts of congestion,
delay and throughput — with risk and confidence estimates tailored for **port
managers and ship managers**. Where the TFT or real AIS is not yet available, the
prototype falls back to a leakage-safe quantile baseline and satellite/proxy
features, keeping the architecture intact and the system demo-ready.
