use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde_json::{json, Value};

use crate::models::*;
use crate::services::{live_service, port_service};
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

/// GET /api/ports/map — pins with regime colour / congestion for the radar.
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

/// GET /api/ports/:port_id/drivers — ranked drivers + expert-module outputs.
pub async fn drivers(
    State(store): State<AppState>,
    Path(port_id): Path<String>,
) -> Result<Json<Enveloped<PortIntel>>, ApiError> {
    let port = port_service::find_port(&store, &port_id)
        .ok_or_else(|| not_found("port", &port_id))?;
    let intel = live_service::port_intel(&store, &port);
    Ok(Json(Enveloped::tagged(store.is_real("panel"), intel)))
}

/// GET /api/ports/:port_id/live — vessel field / anchorage / berth (proxy mode).
pub async fn live(
    State(store): State<AppState>,
    Path(port_id): Path<String>,
) -> Result<Json<Enveloped<PortLive>>, ApiError> {
    let port = port_service::find_port(&store, &port_id)
        .ok_or_else(|| not_found("port", &port_id))?;
    let lv = live_service::port_live(&store, &port);
    // Vessel positions are always simulated (proxy) — never claim "real".
    Ok(Json(Enveloped::mock(lv)))
}

/// GET /api/live — the whole-country vessel field for the radar.
pub async fn live_national(State(store): State<AppState>) -> Json<Enveloped<Vec<PortLive>>> {
    Json(Enveloped::mock(live_service::national_live(&store)))
}

/// GET /api/news — national maritime intelligence feed (GDELT cache or demo).
pub async fn news_national(State(store): State<AppState>) -> Json<Enveloped<Vec<NewsEvent>>> {
    let (events, real) = crate::services::news_service::national(&store);
    Json(Enveloped::tagged(real, events))
}

/// GET /api/ports/:port_id/news — events touching this port.
pub async fn news_port(
    State(store): State<AppState>,
    Path(port_id): Path<String>,
) -> Json<Enveloped<Vec<NewsEvent>>> {
    let (events, real) = crate::services::news_service::for_port(&store, &port_id);
    Json(Enveloped::tagged(real, events))
}

/// POST /api/ask — rule-based Q&A over the loaded model outputs.
pub async fn ask(
    State(store): State<AppState>,
    Json(req): Json<AskRequest>,
) -> Json<AskAnswer> {
    Json(crate::services::news_service::ask(&store, &req.question))
}

/// GET /api/ports/:port_id/wx — WX terminal report.
pub async fn wx(
    State(store): State<AppState>,
    Path(port_id): Path<String>,
) -> Result<Json<Enveloped<WxReport>>, ApiError> {
    let port = port_service::find_port(&store, &port_id)
        .ok_or_else(|| not_found("port", &port_id))?;
    Ok(Json(Enveloped::tagged(store.is_real("panel"),
        crate::services::live_service::wx_report(&store, &port))))
}

/// GET /api/ports/:port_id/sar — SAR proxy report.
pub async fn sar(
    State(store): State<AppState>,
    Path(port_id): Path<String>,
) -> Result<Json<Enveloped<SarReport>>, ApiError> {
    let port = port_service::find_port(&store, &port_id)
        .ok_or_else(|| not_found("port", &port_id))?;
    // SAR detections are always proxy-simulated.
    let _ = store.is_real("panel");
    Ok(Json(Enveloped::mock(
        crate::services::live_service::sar_report(&store, &port))))
}
