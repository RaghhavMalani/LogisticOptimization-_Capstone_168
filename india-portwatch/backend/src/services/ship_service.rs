//! Fleet operations board: joins route recommendations with the per-port
//! ship-manager risk report.

use crate::models::*;
use super::data_loader::DataStore;

pub fn slug(name: &str) -> String {
    name.to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

fn port_report<'a>(store: &'a DataStore, port_id: &str) -> Option<&'a ShipReportRow> {
    store
        .ship_reports
        .iter()
        .find(|r| r.port_id.eq_ignore_ascii_case(port_id))
}

fn build_ship(store: &DataStore, route: &RouteRow) -> Ship {
    let dest = if route.recommended_port.is_empty() {
        route.intended_port.clone()
    } else {
        route.recommended_port.clone()
    };
    let rep = port_report(store, &dest);
    let best = route
        .best_arrival_day
        .or_else(|| rep.and_then(|r| r.best_arrival_day))
        .unwrap_or(5);
    let worst = rep.and_then(|r| r.worst_arrival_day).unwrap_or(2);
    Ship {
        ship_id: slug(&route.vessel),
        name: route.vessel.clone(),
        intended_port: route.intended_port.clone(),
        recommended_port: dest,
        reroute: route
            .reroute
            .as_deref()
            .map(|s| s.eq_ignore_ascii_case("true") || s == "1")
            .unwrap_or(false),
        eta_window: format!("Day +{} – Day +{}", best.min(best + 2), best + 2),
        berth_waiting_risk: rep
            .and_then(|r| r.berth_waiting_risk.clone())
            .unwrap_or_else(|| "moderate".into()),
        port_entry_risk: rep
            .and_then(|r| r.port_entry_risk.clone())
            .unwrap_or_else(|| "moderate".into()),
        best_arrival_day: best,
        worst_arrival_day: worst,
        recommended_buffer_hours: rep
            .and_then(|r| r.recommended_buffer_hours.clone())
            .unwrap_or_else(|| "4-8".into()),
        confidence: rep
            .and_then(|r| r.confidence.clone())
            .unwrap_or_else(|| "medium".into()),
    }
}

pub fn fleet(store: &DataStore) -> Vec<Ship> {
    store
        .routes
        .iter()
        .map(|r| build_ship(store, r))
        .collect()
}

pub fn recommendation(store: &DataStore, ship_id: &str) -> Option<ShipRecommendation> {
    let route = store
        .routes
        .iter()
        .find(|r| slug(&r.vessel) == ship_id.to_lowercase())?;
    let ship = build_ship(store, route);
    let rep = port_report(store, &ship.recommended_port);

    let reason = if ship.reroute {
        format!(
            "Congestion probability at {} exceeds the reroute threshold; {} \
             offers a lower expected berth wait.",
            ship.intended_port, ship.recommended_port
        )
    } else {
        "Congestion probability remains below the high-risk threshold.".into()
    };
    let advisory = route.recommendation.clone().unwrap_or_else(|| {
        format!(
            "{}: keep {} as destination. Best arrival window: Day +{}. \
             Recommended buffer: {} hours. {} Confidence: {}.",
            ship.name,
            ship.recommended_port,
            ship.best_arrival_day,
            ship.recommended_buffer_hours,
            rep.and_then(|r| r.advisory.clone()).unwrap_or_default(),
            ship.confidence
        )
    });
    Some(ShipRecommendation { ship, advisory, reason })
}
