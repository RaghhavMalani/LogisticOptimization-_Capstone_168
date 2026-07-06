use axum::extract::{Path, State};
use axum::Json;

use crate::models::*;
use crate::services::ship_service;
use super::ports::not_found;
use super::AppState;

/// GET /api/ships — the fleet operations board.
pub async fn list(State(store): State<AppState>) -> Json<Enveloped<Vec<Ship>>> {
    Json(Enveloped::tagged(
        store.is_real("routes"),
        ship_service::fleet(&store),
    ))
}

/// GET /api/ships/:ship_id/recommendation — full advisory for one vessel.
pub async fn recommendation(
    State(store): State<AppState>,
    Path(ship_id): Path<String>,
) -> Result<Json<Enveloped<ShipRecommendation>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    let rec = ship_service::recommendation(&store, &ship_id)
        .ok_or_else(|| not_found("ship", &ship_id))?;
    Ok(Json(Enveloped::tagged(store.is_real("routes"), rec)))
}
