//! Shapes the raw forecast rows into the product API structure.

use crate::models::*;
use super::data_loader::DataStore;

fn confidence_label(score: Option<f64>) -> String {
    match score {
        Some(s) if s >= 0.75 => "HIGH".into(),
        Some(s) if s >= 0.5 => "MEDIUM".into(),
        Some(_) => "LOW".into(),
        None => "MEDIUM".into(),
    }
}

pub fn port_forecast(store: &DataStore, port_id: &str) -> Option<PortForecast> {
    let mut rows: Vec<&ForecastRow> = store
        .forecasts
        .iter()
        .filter(|f| f.port_id.eq_ignore_ascii_case(port_id))
        .collect();
    if rows.is_empty() {
        return None;
    }
    // Keep only the latest forecast origin, ordered by horizon day.
    let origin = rows
        .iter()
        .map(|r| r.forecast_origin_date.clone())
        .max()
        .unwrap_or_default();
    rows.retain(|r| r.forecast_origin_date == origin);
    rows.sort_by_key(|r| r.horizon_day);

    let model = rows
        .first()
        .and_then(|r| r.model.clone())
        .unwrap_or_else(|| "baseline".into());

    let horizon = rows
        .iter()
        .map(|r| {
            let q50 = r.q50.or(r.predicted_congestion).unwrap_or(0.0);
            ForecastPoint {
                day: r.horizon_day,
                target_date: r.target_date.clone(),
                congestion_q10: r.q10.unwrap_or(q50),
                congestion_q50: q50,
                congestion_q90: r.q90.unwrap_or(q50),
                delay_hours: r.predicted_delay.unwrap_or(0.0),
                throughput: r.predicted_throughput.unwrap_or(0.0),
                risk: r
                    .risk_level
                    .clone()
                    .unwrap_or_else(|| "MEDIUM".into())
                    .to_uppercase(),
                confidence: confidence_label(r.confidence_score),
            }
        })
        .collect();

    Some(PortForecast {
        port_id: rows[0].port_id.clone(),
        origin_date: origin,
        model,
        horizon,
    })
}
