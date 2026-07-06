pub mod forecasts;
pub mod ports;
pub mod regimes;
pub mod scenarios;
pub mod ships;

use std::sync::Arc;

use axum::{routing::get, routing::post, Json, Router};
use serde_json::json;

use crate::services::data_loader::DataStore;
use crate::services::status_service;

pub type AppState = Arc<DataStore>;

pub fn api_router(state: AppState) -> Router {
    Router::new()
        .route("/api/health", get(health))
        .route("/api/ports", get(ports::list))
        .route("/api/ports/map", get(ports::map))
        .route("/api/ports/:port_id", get(ports::detail))
        .route("/api/ports/:port_id/forecast", get(forecasts::port_forecast))
        .route("/api/ports/:port_id/regime", get(regimes::port_regime))
        .route("/api/ports/:port_id/briefing", get(ports::briefing))
        .route("/api/ports/:port_id/drivers", get(ports::drivers))
        .route("/api/ships", get(ships::list))
        .route("/api/ships/:ship_id/recommendation", get(ships::recommendation))
        .route("/api/scenarios", get(scenarios::list))
        .route("/api/scenarios/simulate", post(scenarios::simulate))
        .route("/api/alerts", get(alerts))
        .route("/api/analytics/summary", get(analytics_summary))
        .route("/api/model/status", get(model_status))
        .with_state(state)
}

async fn health() -> Json<serde_json::Value> {
    Json(json!({"status": "ok", "service": "india-portwatch-backend"}))
}

async fn alerts(
    axum::extract::State(store): axum::extract::State<AppState>,
) -> Json<serde_json::Value> {
    Json(json!({
        "data_mode": store.mode(),
        "data": status_service::alerts(&store),
    }))
}

async fn analytics_summary(
    axum::extract::State(store): axum::extract::State<AppState>,
) -> Json<serde_json::Value> {
    let summary = status_service::analytics_summary(&store);
    Json(json!({
        "data_mode": store.mode(),
        "data": summary,
    }))
}

async fn model_status(
    axum::extract::State(store): axum::extract::State<AppState>,
) -> Json<crate::models::ModelStatus> {
    Json(status_service::model_status(&store))
}
