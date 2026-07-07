use serde::Serialize;

/// Static registry entry for an Indian port (id, geo, capacity attributes).
#[derive(Debug, Clone, Serialize)]
pub struct Port {
    pub port_id: String,
    pub name: String,
    pub region: String, // West | South | East
    pub lat: f64,
    pub lon: f64,
    pub port_capacity: f64,     // relative 0..1
    pub berth_count: u32,
    pub connectivity_score: f64, // 0..1
}

/// What the radar map needs per port: position + live condition.
/// `regime` is UNKNOWN (purple) when the HSMM confidence is LOW.
#[derive(Debug, Clone, Serialize)]
pub struct PortMapPin {
    #[serde(flatten)]
    pub port: Port,
    pub regime: String,          // NORMAL | CONGESTED | SEVERE | UNKNOWN
    pub regime_confidence: String, // LOW | MEDIUM | HIGH
    pub congestion_now: f64,     // 0..100
    pub delay_hours: f64,
    pub throughput: f64,
    pub risk_level: String,      // Low | Medium | High | Critical
    pub transition_risk: f64,
}

/// Operational briefing for the port cockpit (single port only).
#[derive(Debug, Clone, Serialize)]
pub struct PortBriefing {
    pub port_id: String,
    pub port_name: String,
    pub current_regime: String,
    pub days_in_state: f64,
    pub expected_remaining_days: f64,
    pub transition_risk: f64,
    pub peak_congestion_day: i64,
    pub peak_congestion_q50: f64,
    pub peak_congestion_q90: f64,
    pub peak_delay_hours: f64,
    pub mean_throughput: f64,
    pub weather_impact: String,
    pub capacity_risk: String,
    pub high_risk_days: Vec<i64>,
    pub recommended_action: String,
    pub summary: String, // human-readable paragraph
}
