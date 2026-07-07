# India PortWatch Terminal

**v4: command-driven terminal.** A Bloomberg-style command line sits in the top
bar (focus with Ctrl+K or /):

```
RADAR                    national radar map
PORT <ID>                port operations cockpit      PORT CHENNAI
WX <ID>                  weather intelligence report  WX JNPT
SAR <ID>                 Sentinel-1/GEE proxy report  SAR MUNDRA
NLP <query>              news/NLP intelligence        NLP red sea
MODEL <ID>               model intelligence layer     MODEL VIZAG
FORECAST <ID> 10D        10-day forecast (in cockpit)
SIM <SCENARIO> <I>       scenario simulator           SIM CYCLONE 1.5
FLEET                    ship manager board
WHY <ID> <topic>         rule-based explanation       WHY JNPT risk
```

Scenario aliases: CYCLONE STORM STRIKE CAPACITY DEMAND HORMUZ REDSEA FUEL.
New API: GET /api/ports/:id/wx (wind/rain/wave/visibility/cyclone risk,
persistence, shock, impact score, weather_hsmm_input, weather_tft_covariate)
and GET /api/ports/:id/sar (detections, anchorage density, queue activity,
change vs previous scene, SAR confidence, labelled SENTINEL-1/GEE PROXY MODE).
Expert modules now expose input signal, score, confidence, effect on forecast,
and latest run timestamp. Note: after pulling, delete stale hashed files in
frontend-react/dist/assets (index-BjrVqUWC.js, index-DU_SgGls.css) if present.

---

# India PortWatch — AI Maritime Command Center

**v3: React/Vite/TypeScript frontend** (`frontend-react/`) with Framer Motion
page/card animations, MapLibre radar + digital-twin maps, typewriter AI
briefings, News/NLP intelligence, and a rule-based **Ask PortWatch** query box.
The Rust/Axum backend serves the compiled app automatically (it prefers
`frontend-react/dist` over the legacy `frontend/`).

## Run (no Node needed — dist is prebuilt)

```bash
cd india-portwatch
cargo run -p portwatch-backend        # serves API + frontend-react/dist on :8080
```

Frontend development (optional):

```bash
cd frontend-react && npm install && npm run dev    # Vite dev server, proxies /api → :8080
npm run build                                      # refresh dist/
```

## The five experiences

| Route | Experience |
|---|---|
| `/` | **National Port Radar** — full-screen dark map, pulsing regime markers (pulse speed = urgency, size = congestion), drifting proxy-vessel dots, chokepoint route arcs (Hormuz/Bab-el-Mandeb/Malacca), alert ticker, stress gauge, model timestamp |
| `/ports/:id` | **Port Operations Cockpit** — command header cards, digital-twin panel (anchorage ring, queue, berth bars, capacity ring, radar sweep, cinematic zoom-in), 10-day risk tiles, animated HSMM probability bars, driver cards with source modules, typewriter AI briefing, port news |
| `/decision-room` | **AI Decision Room** — 8 shock scenarios × intensity, animated before/after impact cards, AI response plan, details behind View-details |
| `/ships` | **Ship Manager Fleet Board** — operations rows, per-vessel advisory with reroute callouts |
| `/model` | **Model Intelligence Layer** — pipeline chain, per-port expert outputs with confidence, News/NLP feed (entity/type/sentiment/risk/affected ports/model impact), **Ask PortWatch** |

New API (on top of the existing set): `GET /api/news`,
`GET /api/ports/:id/news`, `POST /api/ask` — Ask PortWatch is deliberately
rule-based over the loaded model outputs (no LLM), and says so in its answers.
News events come from the real GDELT connector cache
(`outputs/forecasts/events.csv`) when present, else labelled demo events.

Honesty rules unchanged: vessel dots are an **AIS/satellite proxy simulation**
seeded by real expert features and labelled everywhere; every payload carries
`data_mode: real | partial | mock`.

Note on stack: deck.gl / Three.js were deliberately skipped — MapLibre +
Framer Motion + CSS (conic-gradient radar sweep) deliver the cinematic effect
with a build that stays small and was fully compiled + type-checked here.

---


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
GET  /api/live                          whole-country proxy vessel field
GET  /api/ports/:port_id/live           vessels / anchorage / queue / berth (PROXY)
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
| `/` National Port Radar | all ports: living map (pulsing regime markers incl. purple UNKNOWN, drifting proxy-vessel dots), national stress gauge, top-5 risk, rotating alerts |
| `/ports/:id` Port Operations Cockpit | **selected port only**: AI briefing, port-area vessel field (anchorage ring, queue, berth utilisation — labelled AIS/SATELLITE PROXY MODE), 10-day risk tiles, HSMM probability panel, driver cards, expert-module outputs |
| `/ships` Fleet Board | vessel planning board + per-vessel advisory with reroute callouts |
| `/decision` AI Decision Room | AI briefing + 7 shock presets × intensity → impact cards first, tables behind View-details |
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
