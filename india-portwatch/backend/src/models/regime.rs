use serde::{Deserialize, Serialize};

/// Current HSMM regime state for a port (API shape per product spec).
#[derive(Debug, Clone, Serialize)]
pub struct RegimeState {
    pub port_id: String,
    pub current_regime: String, // NORMAL | CONGESTED | SEVERE
    pub p_normal: f64,
    pub p_congested: f64,
    pub p_severe: f64,
    pub days_in_state: f64,
    pub expected_remaining_days: f64,
    pub transition_risk: f64,
    pub confidence: String, // LOW | MEDIUM | HIGH
}

/// One day of regime history (for the cockpit regime timeline strip).
#[derive(Debug, Clone, Serialize)]
pub struct RegimeDay {
    pub date: String,
    pub regime: String,
    pub p_severe: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct RegimeTimeline {
    pub port_id: String,
    pub current: RegimeState,
    pub history: Vec<RegimeDay>, // trailing window, oldest first
}

/// Raw row of outputs/regimes/regimes.csv (pipeline schema).
#[derive(Debug, Clone, Deserialize)]
pub struct RegimeRow {
    pub port_id: String,
    pub date: String,
    pub regime_label: String,
    pub p_normal: Option<f64>,
    pub p_congested: Option<f64>,
    pub p_severe: Option<f64>,
    pub days_in_state: Option<f64>,
    pub expected_remaining_days: Option<f64>,
    pub transition_risk: Option<f64>,
    pub regime_confidence: Option<f64>,
}
