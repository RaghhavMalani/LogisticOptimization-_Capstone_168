# India PortWatch Data Audit

Audit date: 2026-07-08

This file classifies the datasets currently present in this checkout and how they should feed the engineering-ready terminal.

## Source Data

| File or Folder | Source | Grain | Key Columns | Current Use | Quality / Risk Notes |
|---|---|---:|---|---|---|
| `data/portwatch/port_activity.csv` | IMF PortWatch ArcGIS, India subset | Daily port/activity | `date`, `portid`, `portname`, `portcalls_*`, `import_*`, `export_*`, `canon` | Port activity history, congestion/throughput proxy, backend fallback | Public AIS-derived aggregate. Good for demo and model features, not vessel-level AIS. |
| `data/portwatch/port_activity_summary.csv` | Derived from PortWatch | Latest per port | `portid`, `canon`, `name`, `lat`, `lon`, `portcalls`, `import_tonnes`, `export_tonnes`, vessel class counts | Port registry, map pins, national summary | Current best tabular port lat/lon source in this checkout. |
| `data/portwatch/history/port*.csv` | Derived from PortWatch | Daily per selected port | `date`, `portcalls`, `import`, `export` | Time series fallback for port pages and model inputs | File names are PortWatch numeric IDs; registry mapping is needed for readability. |
| `data/portwatch/chokepoints.csv` | IMF PortWatch chokepoints | Daily chokepoint | `date`, `portname`, `n_total` | Chokepoint route layer and scenario stress | Chokepoint names need normalized codes. |
| `data/portwatch/disruptions.csv` | PortWatch/GDACS disruptions | Event | `eventid`, `eventtype`, `alertlevel`, `country`, `fromdate`, `todate`, `lat`, `long`, `affectedports` | Weather/disruption alert fallback | Event geography is approximate and needs de-duplication by event ID. |

## Preprocessed Feature Data

| File | Grain | Key Columns | Current Use | Quality / Risk Notes |
|---|---:|---|---|---|
| `data/preprocessed/weather_preprocessed_2020_2022.csv` | Daily | `Date`, `Temperature`, `Rainfall`, `WindSpeed`, rolling/lags | Weather expert training/evaluation | Historical physical weather, but may not be port-specific unless joined externally. |
| `data/preprocessed/maritime_news_preprocessed.csv` | Daily | `Date`, `sentiment`, lag/rolling sentiment columns | News/NLP expert | Useful NLP proxy, not raw article corpus. |
| `data/preprocessed/final_economic_features.csv` | Daily/monthly merged | `Date`, `Global_LSCI`, IIP/import/export proxy fields | Demand and macro expert | Mixed frequencies; model builder must avoid future leakage when forward filling. |
| `data/preprocessed/DGQI_merged_2020_2022.csv` | Monthly port/category | `portName`, `month`, `year`, `category`, `dwellTime` | Dwell/delay validation target candidate | Monthly grain is too coarse for daily operational cockpit without careful interpolation flags. |
| `data/sample/*.csv` | Synthetic sample | Weather, news, ops, trade, observed targets | Smoke tests and demo runs | Keep labeled synthetic. Do not present as live evidence. |

## Generated Model Outputs

| File or Folder | Produced By | Grain | Current Use | Quality / Risk Notes |
|---|---|---:|---|---|
| `outputs/expert_features/merged_panel.csv` | `run_demo.py` expert pipeline | Port-day | Rich feature panel for HSMM/TFT/decision fallback | Best current internal feature table. Must preserve date order in training/eval. |
| `outputs/regimes/regimes.csv` | Regime module | Port-day | HSMM regime endpoint and model page | Existing model is HMM/GMM-style with dwell post-processing, not a fully explicit-duration HSMM. |
| `outputs/forecasts/forecast_table.csv` | Forecast runner | Port forecast horizon | TFT/baseline forecast endpoint and cockpit | Contains quantiles and confidence; `model` identifies baseline versus TFT. |
| `outputs/forecasts/decisions.csv` | Decision layer | Port/vessel decision rows | Recommendation fallback | Good deterministic decision seed, but should include provenance in API response. |
| `outputs/forecasts/scenario_*.csv` | Scenario engine | Scenario output | Simulation fallback/reference | Useful for calibrating deterministic frontend scenario engine. |
| `outputs/analytics/*.json|*.csv` | Analytics runner | Mixed | National summary, KPIs, benchmark cards | Good for API summaries, not raw UI dataframe dumps. |

## Frontend Demo Data

| Folder | Role | Backend Replacement |
|---|---|---|
| `india-portwatch-terminal/src/data/ports.ts` | Port registry, risk snapshots, chokepoints, routes | `GET /api/ports`, `GET /api/ports/{port_id}`, `GET /api/ports/map` |
| `india-portwatch-terminal/src/data/vessels.ts` | SAR/AIS proxy vessels and SAR signals | `GET /api/sar/vessels`, `GET /api/sar/{port_id}` |
| `india-portwatch-terminal/src/data/weather.ts` | Weather signals | `GET /api/weather/{port_id}` |
| `india-portwatch-terminal/src/data/news.ts` | News/NLP events and alert feed | `GET /api/news`, `GET /api/news/entity/{entity}` |
| `india-portwatch-terminal/src/data/regimes.ts` | HSMM regime snapshots | `GET /api/model/{port_id}/regime` |
| `india-portwatch-terminal/src/data/forecasts.ts` | Forecasts, model pipeline, gating weights | `GET /api/model/{port_id}/forecast`, `GET /api/model/pipeline` |
| `india-portwatch-terminal/src/data/scenarios.ts` | Scenario definitions | `GET /api/scenarios`, `POST /api/scenarios/simulate` |
| `india-portwatch-terminal/src/data/fleet.ts` | Fleet vessel demo | `GET /api/fleet` |

## Backend Connector Priorities

1. PortWatch ArcGIS public services for port activity, chokepoints, disruptions, and port metadata.
2. Open-Meteo/Open-Meteo Marine for forecast weather and waves.
3. GDELT DOC/event feeds for port and chokepoint news pressure.
4. AIS/SAR provider or Google Earth Engine Sentinel-1 derived vessel detections.
5. DGQI/Sagar Setu/port authority dwell feeds for measured delay targets.

## Training And Evaluation Rules

- Split by time, never random rows.
- Build features using only data available at the forecast origin.
- Keep port ID and date in every feature table.
- Store model outputs with source/provenance labels: `LIVE`, `CACHED`, `DEMO`, or `SYNTHETIC`.
- Report MAE/RMSE for delay/congestion, quantile pinball loss for forecasts, and calibration/coverage for forecast bands.
