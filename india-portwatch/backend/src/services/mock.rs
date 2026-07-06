//! Deterministic demo data for any table the pipeline has not produced.
//!
//! No RNG crate: a tiny hash-based noise function keeps values stable across
//! restarts (same port -> same numbers), which makes demos reproducible.

use chrono::{Duration, Utc};

use crate::models::*;
use super::data_loader::DataStore;

/// Cheap deterministic noise in [0,1) from a string+index seed.
fn noise(seed: &str, i: i64) -> f64 {
    let mut h: u64 = 1469598103934665603;
    for b in seed.bytes() {
        h ^= b as u64;
        h = h.wrapping_mul(1099511628211);
    }
    h ^= i as u64;
    h = h.wrapping_mul(1099511628211);
    (h % 10_000) as f64 / 10_000.0
}

fn risk_from_congestion(c: f64) -> &'static str {
    if c >= 75.0 {
        "Critical"
    } else if c >= 60.0 {
        "High"
    } else if c >= 45.0 {
        "Medium"
    } else {
        "Low"
    }
}

pub fn fill_missing(store: &mut DataStore) {
    let today = Utc::now().date_naive();
    let ports: Vec<Port> = store.ports.clone();

    // ---------------------------------------------------------------- forecasts
    if store.forecasts.is_empty() {
        for p in &ports {
            let base = 35.0 + 30.0 * noise(&p.port_id, 0);
            for d in 1..=10i64 {
                let wave = 8.0 * (noise(&p.port_id, d) - 0.5)
                    + 6.0 * ((d as f64) / 10.0) * noise(&p.port_id, 99 + d);
                let q50 = (base + wave).clamp(5.0, 95.0);
                store.forecasts.push(ForecastRow {
                    port_id: p.port_id.clone(),
                    forecast_origin_date: today.to_string(),
                    target_date: (today + Duration::days(d)).to_string(),
                    horizon_day: d,
                    q10: Some(q50 - 10.0 - 4.0 * noise(&p.port_id, 200 + d)),
                    q50: Some(q50),
                    q90: Some(q50 + 12.0 + 6.0 * noise(&p.port_id, 300 + d)),
                    predicted_congestion: Some(q50),
                    predicted_delay: Some(4.0 + q50 / 8.0),
                    predicted_throughput: Some(40_000.0 + 400_000.0 * p.port_capacity
                        * (0.8 + 0.4 * noise(&p.port_id, 400 + d))),
                    risk_level: Some(risk_from_congestion(q50).to_string()),
                    confidence_score: Some(0.55 + 0.3 * noise(&p.port_id, 500 + d)),
                    model: Some("mock".into()),
                });
            }
        }
    }

    // ------------------------------------------------------------------ regimes
    if store.regimes.is_empty() {
        for p in &ports {
            let stress = noise(&p.port_id, 7); // some ports run hotter
            let mut in_state = 1.0;
            let mut label = "NORMAL";
            for d in 0..60i64 {
                let date = today - Duration::days(59 - d);
                let x = noise(&p.port_id, 1000 + d) + 0.35 * stress;
                let new_label = if x > 0.92 {
                    "SEVERE"
                } else if x > 0.68 {
                    "CONGESTED"
                } else {
                    "NORMAL"
                };
                if new_label == label {
                    in_state += 1.0;
                } else {
                    label = new_label;
                    in_state = 1.0;
                }
                let (pn, pc, ps) = match label {
                    "SEVERE" => (0.08, 0.27, 0.65),
                    "CONGESTED" => (0.20, 0.62, 0.18),
                    _ => (0.74, 0.20, 0.06),
                };
                store.regimes.push(RegimeRow {
                    port_id: p.port_id.clone(),
                    date: date.to_string(),
                    regime_label: label.to_string(),
                    p_normal: Some(pn),
                    p_congested: Some(pc),
                    p_severe: Some(ps),
                    days_in_state: Some(in_state),
                    expected_remaining_days: Some(1.0 + 4.0 * noise(&p.port_id, 2000 + d)),
                    transition_risk: Some(0.1 + 0.3 * noise(&p.port_id, 3000 + d)),
                    regime_confidence: Some(0.6 + 0.35 * noise(&p.port_id, 4000 + d)),
                });
            }
        }
    }

    // ----------------------------------------------------------------- reports
    if store.port_reports.is_empty() {
        for p in &ports {
            let fc: Vec<&ForecastRow> = store
                .forecasts
                .iter()
                .filter(|f| f.port_id == p.port_id)
                .collect();
            let peak = fc
                .iter()
                .max_by(|a, b| {
                    a.q50.unwrap_or(0.0).total_cmp(&b.q50.unwrap_or(0.0))
                })
                .cloned();
            let reg = store
                .regimes
                .iter()
                .filter(|r| r.port_id == p.port_id)
                .last();
            store.port_reports.push(PortReportRow {
                port_id: p.port_id.clone(),
                port_name: Some(p.name.clone()),
                current_regime: reg.map(|r| r.regime_label.clone()),
                days_in_state: reg.and_then(|r| r.days_in_state),
                expected_remaining_days: reg.and_then(|r| r.expected_remaining_days),
                transition_risk: reg.and_then(|r| r.transition_risk),
                peak_congestion_day: peak.map(|f| f.horizon_day),
                peak_congestion_q50: peak.and_then(|f| f.q50),
                peak_congestion_q90: peak.and_then(|f| f.q90),
                peak_delay_hours: peak.and_then(|f| f.predicted_delay),
                mean_throughput: peak.and_then(|f| f.predicted_throughput),
                weather_impact: Some("low".into()),
                capacity_risk: Some(if p.port_capacity > 0.7 { "moderate" } else { "high" }.into()),
                high_risk_horizon_days: None,
                recommended_action: Some(
                    "Monitor berth allocation and maintain standard buffer.".into(),
                ),
            });
        }
    }

    if store.ship_reports.is_empty() {
        for p in &ports {
            let risk = if noise(&p.port_id, 42) > 0.6 { "high" } else { "moderate" };
            store.ship_reports.push(ShipReportRow {
                port_id: p.port_id.clone(),
                port_name: Some(p.name.clone()),
                eta_delay_risk: Some(risk.into()),
                berth_waiting_risk: Some(risk.into()),
                port_entry_risk: Some("moderate".into()),
                best_arrival_day: Some(6 + (noise(&p.port_id, 43) * 4.0) as i64),
                worst_arrival_day: Some(1 + (noise(&p.port_id, 44) * 3.0) as i64),
                recommended_buffer_hours: Some(if risk == "high" { "12-18" } else { "4-8" }.into()),
                weather_hazard_risk: Some("low".into()),
                confidence: Some("medium".into()),
                advisory: Some(format!(
                    "Berth waiting risk at {} is {risk}; plan arrival buffers accordingly.",
                    p.name
                )),
            });
        }
    }

    if store.routes.is_empty() {
        let fleet = [
            ("MV Coromandel", "CHENNAI"),
            ("MV Konkan Star", "JNPT"),
            ("MV Kutch Pioneer", "MUNDRA"),
            ("MV Bengal Trader", "KOLKATA"),
            ("MV Malabar Queen", "COCHIN"),
            ("MV Godavari Spirit", "VIZAG"),
        ];
        for (name, port) in fleet {
            let reroute = noise(name, 1) > 0.8;
            store.routes.push(RouteRow {
                vessel: name.to_string(),
                intended_port: port.to_string(),
                recommended_port: port.to_string(),
                reroute: Some(reroute.to_string()),
                best_arrival_day: Some(5 + (noise(name, 2) * 5.0) as i64),
                recommendation: Some(format!(
                    "{name}: keep {port} as destination. Congestion probability remains \
                     below the high-risk threshold."
                )),
            });
        }
    }

    // ---------------------------------------------------------------- analytics
    if store.league.is_empty() {
        for (i, p) in ports.iter().enumerate() {
            store.league.push(LeagueRow {
                port_id: p.port_id.clone(),
                port_name: Some(p.name.clone()),
                region: Some(p.region.clone()),
                cargo_mt: Some(20.0 + 120.0 * p.port_capacity),
                containers_teu: Some(200_000.0 + 5_500_000.0 * p.connectivity_score * p.port_capacity),
                capacity_utilization: Some(0.55 + 0.4 * noise(&p.port_id, 5)),
                turnaround_days: Some(1.2 + 2.5 * noise(&p.port_id, 6)),
                efficiency_score: Some(0.4 + 0.55 * noise(&p.port_id, 8)),
                throughput_rank: Some((i + 1) as f64),
                efficiency_rank: Some((ports.len() - i) as f64),
            });
        }
    }
    if store.demand.is_empty() {
        for p in &ports {
            store.demand.push(DemandRow {
                port_id: p.port_id.clone(),
                port_name: Some(p.name.clone()),
                demand_index: Some(60.0 + 60.0 * noise(&p.port_id, 9)),
                yoy_growth_pct: Some(-4.0 + 16.0 * noise(&p.port_id, 10)),
                utilization: Some(0.5 + 0.45 * noise(&p.port_id, 11)),
            });
        }
    }
    if store.cargo_split.is_empty() {
        for p in &ports {
            let a = 0.2 + 0.5 * noise(&p.port_id, 12);
            let b = (1.0 - a) * (0.3 + 0.5 * noise(&p.port_id, 13));
            store.cargo_split.push(CargoSplitRow {
                port_id: p.port_id.clone(),
                containerised: Some(a),
                dry_bulk: Some(b),
                liquid_bulk: Some((1.0 - a - b).max(0.0)),
            });
        }
    }
    if store.anomalies.is_empty() {
        for p in ports.iter().take(4) {
            store.anomalies.push(AnomalyRow {
                port_id: p.port_id.clone(),
                date: Some((today - Duration::days(3)).to_string()),
                metric: Some("vessel_density".into()),
                value: Some(20.0 + 30.0 * noise(&p.port_id, 14)),
                zscore: Some(2.5 + 1.5 * noise(&p.port_id, 15)),
            });
        }
    }
}
