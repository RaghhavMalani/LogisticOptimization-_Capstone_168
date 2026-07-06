//! Model/pipeline status for the /model page and the analytics summary.

use serde::Serialize;
use serde_json::json;

use crate::models::*;
use super::data_loader::DataStore;
use super::{port_service, regime_service};

pub fn model_status(store: &DataStore) -> ModelStatus {
    let stage = |name: &str, table: &str, files: &[&str], records: usize| {
        let found: Vec<String> = files
            .iter()
            .filter(|f| store.files_found.contains(&f.to_string()))
            .map(|s| s.to_string())
            .collect();
        let missing: Vec<String> = files
            .iter()
            .filter(|f| !store.files_found.contains(&f.to_string()))
            .map(|s| s.to_string())
            .collect();
        let is_real = store.is_real(table);
        StageStatus {
            stage: name.to_string(),
            status: if is_real {
                "ok".into()
            } else if records > 0 {
                "degraded".into() // running on mock data
            } else {
                "missing".into()
            },
            latest_run: latest_mtime(store, &found),
            files_found: found,
            files_missing: missing,
            records,
            warnings: if is_real {
                vec![]
            } else {
                vec!["using demo data".into()]
            },
        }
    };

    let pipeline = vec![
        stage(
            "DATA",
            "forecasts",
            &["forecasts/forecast_table.csv", "regimes/regimes.csv"],
            store.forecasts.len() + store.regimes.len(),
        ),
        stage(
            "EXPERTS",
            "port_reports",
            &["forecasts/port_manager_report.csv", "forecasts/ship_manager_report.csv"],
            store.port_reports.len() + store.ship_reports.len(),
        ),
        stage(
            "HSMM REGIME",
            "regimes",
            &["regimes/regimes.csv"],
            store.regimes.len(),
        ),
        stage(
            "TFT FORECAST",
            "forecasts",
            &["forecasts/forecast_table.csv"],
            store.forecasts.len(),
        ),
        stage(
            "DECISION",
            "routes",
            &["forecasts/route_recommendations.csv"],
            store.routes.len(),
        ),
        stage(
            "ANALYTICS",
            "league",
            &["analytics/league_table.csv", "analytics/anomalies.csv"],
            store.league.len() + store.anomalies.len(),
        ),
    ];

    ModelStatus {
        pipeline,
        data_mode: store.mode().to_string(),
        outputs_dir: store.outputs_dir.display().to_string(),
        walk_forward: store.walk_forward_overall.clone(),
    }
}

fn latest_mtime(store: &DataStore, files: &[String]) -> Option<String> {
    files
        .iter()
        .filter_map(|f| std::fs::metadata(store.outputs_dir.join(f)).ok())
        .filter_map(|m| m.modified().ok())
        .max()
        .map(|t| {
            let dt: chrono::DateTime<chrono::Utc> = t.into();
            dt.format("%Y-%m-%d %H:%M UTC").to_string()
        })
}

/// National analytics summary for /analytics and the dashboard header cards.
#[derive(Debug, Serialize)]
pub struct AnalyticsSummary {
    pub national: serde_json::Value,
    pub league: Vec<LeagueRow>,
    pub demand: Vec<DemandRow>,
    pub cargo_split: Vec<CargoSplitRow>,
    pub anomalies: Vec<AnomalyRow>,
    pub walk_forward: Vec<WalkForwardRow>,
}

pub fn analytics_summary(store: &DataStore) -> AnalyticsSummary {
    let pins = port_service::map_pins(store);
    let n = pins.len().max(1) as f64;
    let severe: Vec<&str> = pins
        .iter()
        .filter(|p| p.regime == "SEVERE")
        .map(|p| p.port.port_id.as_str())
        .collect();
    let congested = pins.iter().filter(|p| p.regime == "CONGESTED").count();
    let mean_c = pins.iter().map(|p| p.congestion_now).sum::<f64>() / n;
    let mut top: Vec<&PortMapPin> = pins.iter().collect();
    top.sort_by(|a, b| b.congestion_now.total_cmp(&a.congestion_now));

    let national = json!({
        "ports_tracked": pins.len(),
        "mean_congestion": (mean_c * 10.0).round() / 10.0,
        "severe_ports": severe,
        "congested_count": congested,
        "top_risk_ports": top.iter().take(5).map(|p| json!({
            "port_id": p.port.port_id,
            "name": p.port.name,
            "congestion": (p.congestion_now * 10.0).round() / 10.0,
            "regime": p.regime,
            "risk_level": p.risk_level,
        })).collect::<Vec<_>>(),
    });

    AnalyticsSummary {
        national,
        league: store.league.clone(),
        demand: store.demand.clone(),
        cargo_split: store.cargo_split.clone(),
        anomalies: store.anomalies.clone(),
        walk_forward: store.walk_forward.clone(),
    }
}

/// Alerts feed for the command dashboard.
pub fn alerts(store: &DataStore) -> Vec<serde_json::Value> {
    let mut out = Vec::new();
    for pin in port_service::map_pins(store) {
        if pin.regime == "SEVERE" || pin.risk_level.to_uppercase() == "CRITICAL" {
            out.push(json!({
                "level": "severe",
                "port_id": pin.port.port_id,
                "message": format!("{} is in SEVERE regime (congestion {:.0}).",
                                   pin.port.name, pin.congestion_now),
            }));
        } else if pin.regime == "CONGESTED" || pin.risk_level.to_uppercase() == "HIGH" {
            out.push(json!({
                "level": "warning",
                "port_id": pin.port.port_id,
                "message": format!("{} congestion elevated ({:.0}); transition risk {:.0}%.",
                                   pin.port.name, pin.congestion_now,
                                   pin.transition_risk * 100.0),
            }));
        }
    }
    for a in store.anomalies.iter().take(6) {
        out.push(json!({
            "level": "info",
            "port_id": a.port_id,
            "message": format!("Anomaly: {} {} (z={:.1})",
                               a.port_id,
                               a.metric.clone().unwrap_or_default(),
                               a.zscore.unwrap_or(0.0)),
        }));
    }
    out
}

/// Used by the cockpit driver panel: regime probabilities as drivers.
pub fn drivers(store: &DataStore, port_id: &str) -> serde_json::Value {
    let regime = regime_service::current_state(store, port_id);
    match regime {
        Some(r) => json!({
            "port_id": r.port_id,
            "drivers": [
                {"name": "Queue pressure", "value": r.p_congested + r.p_severe},
                {"name": "Severe-state probability", "value": r.p_severe},
                {"name": "Transition risk", "value": r.transition_risk},
            ]
        }),
        None => json!({"port_id": port_id, "drivers": []}),
    }
}
