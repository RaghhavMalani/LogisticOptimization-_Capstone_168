//! HSMM regime outputs -> API shapes (current state + timeline strip).

use crate::models::*;
use super::data_loader::DataStore;

fn conf_label(c: Option<f64>) -> String {
    match c {
        Some(v) if v >= 0.75 => "HIGH".into(),
        Some(v) if v >= 0.5 => "MEDIUM".into(),
        Some(_) => "LOW".into(),
        None => "MEDIUM".into(),
    }
}

fn rows_for<'a>(store: &'a DataStore, port_id: &str) -> Vec<&'a RegimeRow> {
    let mut rows: Vec<&RegimeRow> = store
        .regimes
        .iter()
        .filter(|r| r.port_id.eq_ignore_ascii_case(port_id))
        .collect();
    rows.sort_by(|a, b| a.date.cmp(&b.date)); // ISO dates sort lexicographically
    rows
}

pub fn current_state(store: &DataStore, port_id: &str) -> Option<RegimeState> {
    let rows = rows_for(store, port_id);
    let last = rows.last()?;
    Some(RegimeState {
        port_id: last.port_id.clone(),
        current_regime: last.regime_label.to_uppercase(),
        p_normal: last.p_normal.unwrap_or(0.0),
        p_congested: last.p_congested.unwrap_or(0.0),
        p_severe: last.p_severe.unwrap_or(0.0),
        days_in_state: last.days_in_state.unwrap_or(1.0),
        expected_remaining_days: last.expected_remaining_days.unwrap_or(1.0),
        transition_risk: last.transition_risk.unwrap_or(0.0),
        confidence: conf_label(last.regime_confidence),
    })
}

pub fn timeline(store: &DataStore, port_id: &str, days: usize) -> Option<RegimeTimeline> {
    let rows = rows_for(store, port_id);
    let current = current_state(store, port_id)?;
    let start = rows.len().saturating_sub(days);
    let history = rows[start..]
        .iter()
        .map(|r| RegimeDay {
            date: r.date.clone(),
            regime: r.regime_label.to_uppercase(),
            p_severe: r.p_severe.unwrap_or(0.0),
        })
        .collect();
    Some(RegimeTimeline {
        port_id: current.port_id.clone(),
        current,
        history,
    })
}
