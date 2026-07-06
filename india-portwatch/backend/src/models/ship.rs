use serde::{Deserialize, Serialize};

/// One vessel on the fleet operations board.
#[derive(Debug, Clone, Serialize)]
pub struct Ship {
    pub ship_id: String, // slug, e.g. "mv-coromandel"
    pub name: String,
    pub intended_port: String,
    pub recommended_port: String,
    pub reroute: bool,
    pub eta_window: String, // e.g. "Day +3 – Day +5"
    pub berth_waiting_risk: String,
    pub port_entry_risk: String,
    pub best_arrival_day: i64,
    pub worst_arrival_day: i64,
    pub recommended_buffer_hours: String,
    pub confidence: String,
}

/// Full recommendation for GET /api/ships/:ship_id/recommendation.
#[derive(Debug, Clone, Serialize)]
pub struct ShipRecommendation {
    #[serde(flatten)]
    pub ship: Ship,
    pub advisory: String,
    pub reason: String,
}

/// Raw row of outputs/forecasts/route_recommendations.csv.
#[derive(Debug, Clone, Deserialize)]
pub struct RouteRow {
    pub vessel: String,
    pub intended_port: String,
    pub recommended_port: String,
    pub reroute: Option<String>,
    pub best_arrival_day: Option<i64>,
    pub recommendation: Option<String>,
}

/// Raw row of outputs/forecasts/ship_manager_report.csv (per port).
#[derive(Debug, Clone, Deserialize)]
pub struct ShipReportRow {
    pub port_id: String,
    pub port_name: Option<String>,
    pub eta_delay_risk: Option<String>,
    pub berth_waiting_risk: Option<String>,
    pub port_entry_risk: Option<String>,
    pub best_arrival_day: Option<i64>,
    pub worst_arrival_day: Option<i64>,
    pub recommended_buffer_hours: Option<String>,
    pub weather_hazard_risk: Option<String>,
    pub confidence: Option<String>,
    pub advisory: Option<String>,
}
