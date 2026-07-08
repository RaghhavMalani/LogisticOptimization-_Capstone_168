# India PortWatch Repo Audit

Audit date: 2026-07-08

This repository contains three overlapping product generations:

1. The accepted Lovable terminal UI in `india-portwatch-terminal/`.
2. A prior Rust/API plus React/MapLibre product in `india-portwatch/`.
3. The research and modelling pipeline in root `src/`, `app/`, `data/`, and `outputs/`.

No files were deleted during this audit. Cleanup should happen only after these boundaries are confirmed.

## Keep As Active Product

| Path | Role | Notes |
|---|---|---|
| `india-portwatch-terminal/` | Current frontend product | Lovable visual baseline. Preserve terminal shell, dark styling, panels, typography, navigation, and page structure. |
| `india-portwatch-terminal/src/types/` | Frontend typed models | Canonical TypeScript contract for the terminal demo/application layer. |
| `india-portwatch-terminal/src/data/` | Frontend demo data | Local deterministic fallback until backend APIs are fully live. |
| `india-portwatch-terminal/src/services/` | Frontend service boundary | Local and backend-ready access layer for UI pages. |
| `india-portwatch-terminal/src/components/map/` | Active geospatial map boundary | Real lat/lon Leaflet radar layers belong here. |
| `data/portwatch/` | PortWatch-derived public maritime data | Port activity, chokepoints, disruptions, and historical port series. |
| `data/preprocessed/` | Preprocessed historical features | Useful for training, backtesting, expert feature engineering, and docs. |
| `outputs/` | Generated model and analytics outputs | Backend fallback source for regimes, forecasts, decisions, and analytics. |
| `src/experts/` | Expert feature modules | Weather, news, port ops, trade demand, macro signals. |
| `src/regimes/` | Regime modelling | Existing HSMM/HMM-style regime machinery. |
| `src/forecasting/` | Forecast modelling | Baseline quantile forecast and optional TFT path. |
| `src/decision/` | Decision/scenario logic | Decision layer, route optimization, scenario impacts. |
| `src/evaluation/` | Evaluation utilities | Walk-forward and metric helpers. |
| `app/data/portwatch.py` | PortWatch data adapter | Live ArcGIS public data refresh path. |

## Keep As Backend Reference

| Path | Role | Notes |
|---|---|---|
| `india-portwatch/backend/` | Existing Rust backend | Already exposes many relevant API endpoints over local CSV/output data. Treat as reference or parallel option. |
| `india-portwatch/frontend-react/` | Earlier React/MapLibre frontend | Useful component/API reference, not the accepted visual baseline. Do not copy visual design wholesale. |
| `india-portwatch/data/geo/india_ports.geojson` | India port geospatial reference | Useful lat/lon source for map correctness. |
| `docs/DATA_SOURCES.md` | Data source catalogue | Already documents live versus planned feeds. Keep and extend. |

## Legacy Prototype Candidates

These are not deleted. They are candidates for archive after the active terminal/backend path is stable.

| Path | Why It Looks Legacy | Suggested Action |
|---|---|---|
| `src/dashboard/` | Streamlit/static dashboard prototypes; not the Lovable terminal. | Archive after final terminal routes cover same value. |
| `src/webapp/` | Older lightweight HTML data app. | Archive after backend API and terminal are stable. |
| `app/ui/` | Generated static UI snapshot. | Archive once docs confirm no missing data transform. |
| `india-portwatch/frontend/` | Earlier static frontend. | Archive after Rust backend/API references are harvested. |
| `india-portwatch/frontend-react/dist/` | Built artifacts. | Usually removable from source control after confirming deployment needs. |
| `lightning_logs/` | Training run outputs. | Keep for reproducibility only if tied to a model card; otherwise move to artifact storage. |

## Current Architecture Target

The engineering-ready application should use these boundaries:

```
india-portwatch-terminal/
  src/types/          TypeScript app/domain contracts
  src/data/           deterministic local fallback data
  src/services/       API-first frontend service functions
  src/components/map/ Leaflet lat/lon radar layers
  src/routes/         preserved Lovable terminal pages

backend/
  app/main.py         FastAPI application entrypoint
  app/routers/        REST endpoints
  app/services/       data connectors and fallback readers
  app/engines/        expert, regime, forecast, scenario, decision logic
  training/           dataset build, walk-forward eval, training scripts
```

## Immediate Cleanup Rules

- Do not delete legacy dashboards before the backend API and terminal pages are verified.
- Do not redesign `india-portwatch-terminal`; only modularize and wire data.
- Prefer local demo data and `outputs/` readers as deterministic fallbacks.
- Keep external API connectors disabled by default unless explicitly refreshed.
- Mark mock/demo values in service responses and docs so backend integration is unambiguous.
