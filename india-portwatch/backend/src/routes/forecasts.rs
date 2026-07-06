use axum::extract::{Path, State};
use axum::Json;

use crate::models::*;
use crate::services::forecast_service;
use super::ports::not_found;
use super::AppState;

/// GET /api/ports/:port_id/forecast — latest 1..10-day quantile forecast.
pub async fn port_forecast(
    State(store): State<AppState>,
    Path(port_id): Path<String>,
) -> Result<Json<Enveloped<PortForecast>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    let fc = forecast_service::port_forecast(&store, &port_id)
        .ok_or_else(|| not_found("forecast for port", &port_id))?;
    Ok(Json(Enveloped::tagged(store.is_real("forecasts"), fc)))
}
