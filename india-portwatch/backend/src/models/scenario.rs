use serde::{Deserialize, Serialize};

/// A selectable what-if shock preset.
#[derive(Debug, Clone, Serialize)]
pub struct ScenarioPreset {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String, // weather | labour | capacity | demand | chokepoint
}

/// Request body for POST /api/scenarios/simulate.
#[derive(Debug, Clone, Deserialize)]
pub struct SimulateRequest {
    pub scenario_id: String,
    /// Optional intensity multiplier 0.5..2.0 (1.0 = calibrated default).
    #[serde(default = "default_intensity")]
    pub intensity: f64,
}
fn default_intensity() -> f64 {
    1.0
}

/// Per-port impact of a simulated shock.
#[derive(Debug, Clone, Serialize)]
pub struct PortImpact {
    pub port_id: String,
    pub port_name: String,
    pub lat: f64,
    pub lon: f64,
    pub baseline_congestion: f64,
    pub scenario_congestion: f64,
    pub congestion_delta: f64,
    pub baseline_delay_hours: f64,
    pub scenario_delay_hours: f64,
    pub delay_delta_hours: f64,
    pub throughput_change_pct: f64,
    pub risk_before: String,
    pub risk_after: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScenarioResult {
    pub scenario_id: String,
    pub scenario_name: String,
    pub intensity: f64,
    pub affected_ports: Vec<PortImpact>,
    pub national_summary: String,
    pub recommended_response: Vec<String>,
}
