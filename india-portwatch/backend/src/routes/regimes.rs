use axum::extract::{Path, State};
use axum::Json;

use crate::models::*;
use crate::services::regime_service;
use super::ports::not_found;
use super::AppState;

/// GET /api/ports/:port_id/regime — current HSMM state + 45-day timeline.
pub async fn port_regime(
    State(store): State<AppState>,
    Path(port_id): Path<String>,
) -> Result<Json<Enveloped<RegimeTimeline>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    let tl = regime_service::timeline(&store, &port_id, 45)
        .ok_or_else(|| not_found("regime for port", &port_id))?;
    Ok(Json(Enveloped::tagged(store.is_real("regimes"), tl)))
}
