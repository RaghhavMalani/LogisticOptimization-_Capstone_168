use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use serde_json::{json, Value};

use crate::models::*;
use crate::services::scenario_service;
use super::AppState;

/// GET /api/scenarios — available what-if presets.
pub async fn list(State(_store): State<AppState>) -> Json<Enveloped<Vec<ScenarioPreset>>> {
    Json(Enveloped::real(scenario_service::presets()))
}

/// POST /api/scenarios/simulate — apply a shock to the current forecast.
pub async fn simulate(
    State(store): State<AppState>,
    Json(req): Json<SimulateRequest>,
) -> Result<Json<Enveloped<ScenarioResult>>, (StatusCode, Json<Value>)> {
    let result = scenario_service::simulate(&store, &req).ok_or((
        StatusCode::BAD_REQUEST,
        Json(json!({"error": format!("unknown scenario '{}'", req.scenario_id)})),
    ))?;
    Ok(Json(Enveloped::tagged(store.is_real("forecasts"), result)))
}
