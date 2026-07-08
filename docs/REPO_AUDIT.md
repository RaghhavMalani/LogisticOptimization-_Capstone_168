# India PortWatch Repo Audit

Audit date: 2026-07-08

This checkout currently has three useful tracks:

1. `india-portwatch-terminal/` - the accepted Lovable terminal UI. Preserve the dark command-terminal visual baseline.
2. `src/`, `app/`, `data/`, `features/`, `outputs/` - the Python research/modeling pipeline.
3. `backend/` - a FastAPI demo/API shell that currently reads local/demo data and selected generated outputs.

No separate `india-portwatch/` Rust or React reference app exists in this checkout.

## Active Product Boundary

| Path | Role | Notes |
|---|---|---|
| `india-portwatch-terminal/` | Current frontend product | Lovable terminal UI, now MapLibre-based on the radar route. |
| `india-portwatch-terminal/src/types/` | Frontend typed models | TypeScript contracts for ports, vessels, weather, SAR, news, regimes, forecasts, decisions, fleet, scenarios, and pipeline status. |
| `india-portwatch-terminal/src/data/` | Frontend demo data | Deterministic local fallback data until backend/model outputs are wired. |
| `india-portwatch-terminal/src/services/` | Frontend service boundary | API-first wrappers plus local fallback helpers. |
| `india-portwatch-terminal/src/components/map/` | Active geospatial map boundary | Live map is `MaritimeMap.tsx`; keep `MapControls.tsx`, `mapUtils.ts`, and `types.ts`. |
| `backend/` | FastAPI demo backend | Useful API contract shell, but not yet the production model runtime. |

## Model Pipeline Boundary

| Path | Role | Status |
|---|---|---|
| `src/experts/` | Expert feature modules | Weather, news, port ops/AIS proxy, trade demand, and macro signals. |
| `src/regimes/regime_features.py` | HSMM feature builder | Selects and cleans the feature matrix consumed by the regime model. |
| `src/regimes/hsmm_model.py` | HSMM-style regime model | Uses `hmmlearn.GaussianHMM` when available, otherwise `sklearn.mixture.GaussianMixture`, then adds semi-Markov dwell/duration outputs. |
| `src/forecasting/tft_dataset.py` | TFT dataset builder | Builds supervised and inference frames with known-future and unknown-real covariates. |
| `src/forecasting/tft_model.py` | Trainable TFT wrapper | Uses `pytorch-forecasting` TemporalFusionTransformer when the heavy stack is installed. |
| `src/forecasting/forecast_runner.py` | Forecast selector | `model="tft"` trains/uses TFT if available; `model="auto"` falls back to the baseline if torch/TFT dependencies are missing. |
| `requirements-tft.txt` | TFT dependency set | Install only for the real TFT path: torch, pytorch-forecasting, lightning. |
| `src/decision/` | Decision/scenario logic | Consumes regimes and forecasts to produce recommendations, route options, and scenario impacts. |
| `outputs/` | Generated artifacts | Regimes, forecasts, decisions, metrics, and analytics. Ignored in Git because it is regeneratable. |

## Current Integration Reality

- The frontend currently shows deterministic demo data from `india-portwatch-terminal/src/data/`.
- The FastAPI backend currently exposes local/demo endpoints and some output readers.
- The real HSMM/TFT implementation is in the root Python `src/` pipeline, not inside the frontend.
- The backend is not yet directly training/running `src/regimes/hsmm_model.py` or `src/forecasting/tft_model.py` on request.

## Cleanup Notes

- Tracked local Vite logs under `work/` were removed; `work/` is now ignored.
- Unused Leaflet-era map components were removed after verifying no active route imported them.
- Leaflet packages were removed from the terminal app; MapLibre remains the active map dependency.
- Do not delete `src/regimes/`, `src/forecasting/`, `requirements-tft.txt`, or model output schemas. Those are the model assets we will wire next.

## Legacy Candidates To Revisit Later

| Path | Why It Looks Legacy | Suggested Action |
|---|---|---|
| `src/dashboard/` | Streamlit/static dashboard prototype, not the accepted terminal UI. | Archive only after terminal/backend coverage is confirmed. |
| `src/webapp/` | Older lightweight static web app. | Archive after its useful transforms are checked. |
| `app/` | Data adapters and older support code. | Keep until PortWatch refresh/data-loading ownership is settled. |
| `features/` | Exploratory notebooks/scripts. | Keep for project evidence unless user wants a lean app-only repo. |

## Immediate Rules

- Do not redesign `india-portwatch-terminal`.
- Treat `src/regimes/` and `src/forecasting/` as protected model code.
- Keep API/backend work separate from frontend visual cleanup unless explicitly requested.
- Mark demo/mock values clearly until the Python model outputs are wired into services.
