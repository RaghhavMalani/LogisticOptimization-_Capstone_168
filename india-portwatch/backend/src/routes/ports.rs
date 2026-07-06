use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde_json::{json, Value};

use crate::models::*;
use crate::services::{port_service, status_service};
use super::AppState;

type ApiError = (StatusCode, Json<Value>);

pub fn not_found(what: &str, id: &str) -> ApiError {
    (
        StatusCode::NOT_FOUND,
        Json(json!({"error": format!("{what} '{id}' not found")})),
    )
}

/// GET /api/ports — registry (static attributes).
pub async fn list(State(store): State<AppState>) -> Json<Enveloped<Vec<Port>>> {
    Json(Enveloped::real(port_service::all_ports(&store)))
}

/// GET /api/ports/map — pins with regime colour / congestion for the ATC map.
pub async fn map(State(store): State<AppState>) -> Json<Enveloped<Vec<PortMapPin>>> {
    Json(Enveloped::tagged(
        store.mode() == "real",
        port_service::map_pins(&store),
    ))
}

/// GET /api/ports/:port_id — single-port snapshot (registry + live condition).
pub async fn detail(
    State(store): State<AppState>,
    Path(port_id): Path<String>,
) -> Result<Json<Enveloped<PortMapPin>>, ApiError> {
    let pin = port_service::map_pins(&store)
        .into_iter()
        .find(|p| p.port.port_id.eq_ignore_ascii_case(&port_id))
        .ok_or_else(|| not_found("port", &port_id))?;
    Ok(Json(Enveloped::tagged(store.mode() == "real", pin)))
}

/// GET /api/ports/:port_id/briefing — operational summary for the cockpit.
pub async fn briefing(
    State(store): State<AppState>,
    Path(port_id): Path<String>,
) -> Result<Json<Enveloped<PortBriefing>>, ApiError> {
    let b = port_service::briefing(&store, &port_id)
        .ok_or_else(|| not_found("port", &port_id))?;
    Ok(Json(Enveloped::tagged(store.is_real("port_reports"), b)))
}

/// GET /api/ports/:port_id/drivers — driver panel data.
pub async fn drivers(
    State(store): State<AppState>,
    Path(port_id): Path<String>,
) -> Json<Value> {
    Json(json!({
        "data_mode": store.mode(),
        "data": status_service::drivers(&store, &port_id),
    }))
}
