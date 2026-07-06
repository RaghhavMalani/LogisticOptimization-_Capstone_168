# India PortWatch — Operational Command Center (Rust)

A map-first, ATC-style command center for Indian port intelligence. Rust/Axum
backend serving typed JSON from the model pipeline's outputs; dark
FlightRadar-style frontend with an India-focused MapLibre map. **Streamlit is
gone entirely** — this is a product, not a notebook.

```
Model pipeline (Python, ../run_demo.py)  →  outputs/*.csv
Rust backend (Axum)                      →  /api/* + serves the frontend
Frontend (static SPA + MapLibre)         →  Command / Cockpit / Ships / Scenarios / Analytics / Model
```

## What replaced Streamlit

| Streamlit problem | Replacement |
|---|---|
| Endless scrolling notebook | Six focused pages behind a router |
| Raw dataframe dumps | Cards, fan charts, regime strips, styled ops tables |
| All ports shown everywhere | Command deck = all ports; **cockpit = one port only**; scenarios = affected ports only |
| Ugly non-India map | MapLibre dark basemap locked to India, regime-coloured pulsing markers sized by congestion (SVG vector fallback offline) |
| White matplotlib charts | Custom SVG quantile fan charts / bars in the terminal theme |
| Python server + widget reruns | Compiled Rust binary, one process, instant navigation |

`streamlit run src/dashboard/app.py` in the parent repo still works but is
deprecated by this app.

## Architecture

```
india-portwatch/
├── backend/src/
│   ├── main.rs            Axum server: /api/* + static SPA fallback
│   ├── config.rs          outputs dir / frontend dir / port (env-overridable)
│   ├── models/            Port, ForecastPoint, RegimeState, PortBriefing,
│   │                      ShipRecommendation, ScenarioResult, ModelStatus (+ CSV row types)
│   ├── services/
│   │   ├── data_loader.rs CSV → typed stores; per-table real/mock tagging
│   │   ├── mock.rs        deterministic demo data for anything missing
│   │   ├── port_service.rs / forecast_service.rs / regime_service.rs
│   │   ├── ship_service.rs / scenario_service.rs / status_service.rs
│   └── routes/            thin handlers per resource
├── frontend/              dependency-free SPA (see "Frontend" below)
│   ├── index.html · styles/app.css
│   └── js/ api.js · components.js · map.js · app.js
├── data/geo/india_ports.geojson
├── run_dev.sh
└── Cargo.toml             (workspace)
```

Stack: axum · tokio · serde · csv · chrono · tower-http · tracing ·
anyhow/thiserror. Polars was skipped deliberately — outputs are small; the
loader is one file and can be swapped for Polars/DuckDB when Parquet arrives.

**Frontend note (priority path).** Per the fallback priority ("Rust backend +
clean modern frontend" first), the UI is a dependency-free static SPA with
vanilla JS modules — no build step, no Node toolchain; the only external JS is
MapLibre GL for map interop. The component set (`MetricCard`, `RiskBadge`,
`ForecastTimeline`, `RegimeTimeline`, `DriverPanel`, `ScenarioPanel`,
`ShipRouteTable`, `PipelineStepper`, `PortMap`) is mirrored in
`js/components.js`/`js/map.js`, so porting to Leptos components later is a
1:1 translation. A Tauri wrapper can point at the same backend.

## API

```
GET  /api/health
GET  /api/ports                         registry (static attributes)
GET  /api/ports/map                     map pins: regime, congestion, risk
GET  /api/ports/:port_id                single-port snapshot
GET  /api/ports/:port_id/forecast       10-day q10/q50/q90 + delay + throughput
GET  /api/ports/:port_id/regime         HSMM state + 45-day timeline
GET  /api/ports/:port_id/briefing       operational summary + recommended action
GET  /api/ports/:port_id/drivers        driver panel data
GET  /api/ships                         fleet board
GET  /api/ships/:ship_id/recommendation full vessel advisory
GET  /api/scenarios                     what-if presets
POST /api/scenarios/simulate            {"scenario_id":"cyclone_east_coast","intensity":1.2}
GET  /api/alerts
GET  /api/analytics/summary
GET  /api/model/status                  DATA→EXPERTS→HSMM→TFT→DECISION→ANALYTICS
```

Every response carries `data_mode: "real" | "partial" | "mock"` (+ warning when
mock), also shown as a chip in the top bar.

## Run

```bash
cd india-portwatch
./run_dev.sh                 # or: cargo run -p portwatch-backend
# → http://localhost:8080
```

Windows PowerShell:

```powershell
cd india-portwatch
$env:PORTWATCH_OUTPUTS_DIR = "..\outputs"   # optional; auto-detected
cargo run -p portwatch-backend
```

There is no separate frontend build — the backend serves `frontend/` directly
with SPA fallback, so `/ports/CHENNAI` deep-links work.

## Data connection & mock fallback

The loader looks for the pipeline outputs (each with legacy-name fallbacks):

```
outputs/forecasts/forecast_table.csv      (or tft_forecasts.csv)
outputs/regimes/regimes.csv               (or hsmm_regimes.csv)
outputs/forecasts/port_manager_report.csv (or dashboard_exports/port_manager_view.csv)
outputs/forecasts/ship_manager_report.csv (or dashboard_exports/ship_manager_view.csv)
outputs/forecasts/route_recommendations.csv
outputs/forecasts/walk_forward_metrics.csv + walk_forward_overall.json
outputs/analytics/{league_table,demand_index,cargo_type_split,anomalies}.csv
```

Missing/unparseable tables never crash the server: each falls back
independently to deterministic demo data (hash-seeded, stable across restarts)
and the affected endpoints report `data_mode: "mock"`. Refresh real data with
`python run_demo.py --source portwatch` in the parent repo, then restart the
backend.

## Pages

| Route | Rule enforced |
|---|---|
| `/` Command Dashboard | all ports: ATC map, national cards, top-risk, alerts, readiness — no tables |
| `/ports/:id` Port Cockpit | **selected port only**: fan chart, delay/throughput bars, regime strip, drivers, briefing |
| `/ships` Ship Manager | fleet ops board + per-vessel advisory |
| `/scenarios` | 7 shock presets × intensity slider → affected ports only, cards first |
| `/analytics` | all-port comparison (styled tables allowed here) |
| `/model` | pipeline stepper + per-stage files/records/warnings |

## Limitations

- Not compiled in this authoring environment (no Rust toolchain available
  here); dependencies are pinned to stable majors (axum 0.7 / tower-http 0.5).
  If anything trips on your machine, it will be at `cargo build` — fixes should
  be one-liners.
- Map tiles (CARTO dark) and MapLibre come from CDN; fully offline the app
  drops to the built-in SVG India fallback automatically.
- Scenario engine uses transparent elasticity multipliers on the live
  forecast — good for demos; swap in the Python scenario engine's calibrated
  outputs for research claims.
- Backend loads outputs at startup; restart (or add a file-watcher later) after
  re-running the pipeline.
- `delay_hours` inherits the pipeline's proxy caveat (see parent repo README).
