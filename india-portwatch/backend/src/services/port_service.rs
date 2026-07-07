//! Port registry, radar map pins, and cockpit briefings.

use crate::models::*;
use super::data_loader::DataStore;
use super::{forecast_service, regime_service};

pub fn all_ports(store: &DataStore) -> Vec<Port> {
    store.ports.clone()
}

pub fn find_port(store: &DataStore, port_id: &str) -> Option<Port> {
    store
        .ports
        .iter()
        .find(|p| p.port_id.eq_ignore_ascii_case(port_id))
        .cloned()
}

/// One pin per port for the radar: regime colour + size by congestion.
/// Purple/UNKNOWN when the HSMM's confidence in the state is LOW.
pub fn map_pins(store: &DataStore) -> Vec<PortMapPin> {
    store
        .ports
        .iter()
        .map(|p| {
            let regime = regime_service::current_state(store, &p.port_id);
            let fc = forecast_service::port_forecast(store, &p.port_id);
            let first = fc.as_ref().and_then(|f| f.horizon.first().cloned());
            let conf = regime
                .as_ref()
                .map(|r| r.confidence.clone())
                .unwrap_or_else(|| "LOW".into());
            let label = match &regime {
                Some(r) if conf != "LOW" => r.current_regime.clone(),
                Some(_) => "UNKNOWN".into(), // low confidence -> purple
                None => "UNKNOWN".into(),
            };
            PortMapPin {
                port: p.clone(),
                regime: label,
                regime_confidence: conf,
                congestion_now: first.as_ref().map(|h| h.congestion_q50).unwrap_or(0.0),
                delay_hours: first.as_ref().map(|h| h.delay_hours).unwrap_or(0.0),
                throughput: first.as_ref().map(|h| h.throughput).unwrap_or(0.0),
                risk_level: first
                    .as_ref()
                    .map(|h| h.risk.clone())
                    .unwrap_or_else(|| "LOW".into()),
                transition_risk: regime.map(|r| r.transition_risk).unwrap_or(0.0),
            }
        })
        .collect()
}

/// Human-readable operational briefing for the cockpit (single port only).
pub fn briefing(store: &DataStore, port_id: &str) -> Option<PortBriefing> {
    let port = find_port(store, port_id)?;
    let report = store
        .port_reports
        .iter()
        .find(|r| r.port_id.eq_ignore_ascii_case(port_id));
    let regime = regime_service::current_state(store, port_id);
    let fc = forecast_service::port_forecast(store, port_id);

    // Peak day from the report if present, else compute from the forecast.
    let (peak_day, peak_q50, peak_q90, peak_delay) = if let Some(r) = report {
        (
            r.peak_congestion_day.unwrap_or(1),
            r.peak_congestion_q50.unwrap_or(0.0),
            r.peak_congestion_q90.unwrap_or(0.0),
            r.peak_delay_hours.unwrap_or(0.0),
        )
    } else if let Some(f) = &fc {
        let peak = f
            .horizon
            .iter()
            .max_by(|a, b| a.congestion_q50.total_cmp(&b.congestion_q50))?;
        (peak.day, peak.congestion_q50, peak.congestion_q90, peak.delay_hours)
    } else {
        (1, 0.0, 0.0, 0.0)
    };

    let high_risk_days: Vec<i64> = report
        .and_then(|r| r.high_risk_horizon_days.clone())
        .map(|s| {
            s.split(|c: char| !c.is_ascii_digit())
                .filter(|t| !t.is_empty())
                .filter_map(|t| t.parse().ok())
                .collect()
        })
        .unwrap_or_else(|| {
            fc.as_ref()
                .map(|f| {
                    f.horizon
                        .iter()
                        .filter(|h| h.risk == "HIGH" || h.risk == "CRITICAL")
                        .map(|h| h.day)
                        .collect()
                })
                .unwrap_or_default()
        });

    let current_regime = regime
        .as_ref()
        .map(|r| r.current_regime.clone())
        .unwrap_or_else(|| "NORMAL".into());
    let confidence = regime
        .as_ref()
        .map(|r| r.confidence.to_lowercase())
        .unwrap_or_else(|| "medium".into());
    let capacity_risk = report
        .and_then(|r| r.capacity_risk.clone())
        .unwrap_or_else(|| "moderate".into());
    let weather_impact = report
        .and_then(|r| r.weather_impact.clone())
        .unwrap_or_else(|| "low".into());

    // Assistant-style recommended action with a concrete avoid-window.
    let avoid_from = peak_day.max(1);
    let avoid_to = (peak_day + 2).min(10);
    let action = report
        .and_then(|r| r.recommended_action.clone())
        .unwrap_or_else(|| match current_regime.as_str() {
            "SEVERE" => format!(
                "Activate congestion protocol: extend gate hours, prioritise \
                 high-value berths, and divert non-critical arrivals away from \
                 Day +{avoid_from} to Day +{avoid_to}."
            ),
            "CONGESTED" => format!(
                "Tighten berth allocation windows, pre-clear customs for priority \
                 vessels, and avoid scheduling excess arrivals on Day +{avoid_from} \
                 to Day +{avoid_to}."
            ),
            _ => format!(
                "Maintain standard vessel buffer, monitor berth allocation, and \
                 avoid scheduling excess arrivals on Day +{avoid_from} to Day +{avoid_to}."
            ),
        });

    let stability = match current_regime.as_str() {
        "SEVERE" => "under severe congestion",
        "CONGESTED" => "congested",
        _ if capacity_risk == "high" => "currently stable, but capacity risk is elevated",
        _ => "currently stable",
    };
    let summary = format!(
        "{} is {} ({} confidence). The model expects peak congestion on Day +{} \
         (q50 ~{:.0}, q90 ~{:.0}) with delays up to ~{:.0} h. Weather impact is \
         {}; capacity risk is {}. Recommended action: {}",
        port.name, stability, confidence, peak_day, peak_q50, peak_q90,
        peak_delay, weather_impact, capacity_risk, action
    );

    Some(PortBriefing {
        port_id: port.port_id.clone(),
        port_name: port.name.clone(),
        current_regime,
        days_in_state: regime.as_ref().map(|r| r.days_in_state).unwrap_or(1.0),
        expected_remaining_days: regime
            .as_ref()
            .map(|r| r.expected_remaining_days)
            .unwrap_or(1.0),
        transition_risk: regime.as_ref().map(|r| r.transition_risk).unwrap_or(0.0),
        peak_congestion_day: peak_day,
        peak_congestion_q50: peak_q50,
        peak_congestion_q90: peak_q90,
        peak_delay_hours: peak_delay,
        mean_throughput: report.and_then(|r| r.mean_throughput).unwrap_or(0.0),
        weather_impact,
        capacity_risk,
        high_risk_days,
        recommended_action: action,
        summary,
    })
}
