use serde::{Deserialize, Serialize};

/// One horizon step of the 1..10-day forecast (API shape per product spec).
#[derive(Debug, Clone, Serialize)]
pub struct ForecastPoint {
    pub day: i64,
    pub target_date: String,
    pub congestion_q10: f64,
    pub congestion_q50: f64,
    pub congestion_q90: f64,
    pub delay_hours: f64,
    pub throughput: f64,
    pub risk: String,       // LOW | MEDIUM | HIGH | CRITICAL
    pub confidence: String, // LOW | MEDIUM | HIGH
}

#[derive(Debug, Clone, Serialize)]
pub struct PortForecast {
    pub port_id: String,
    pub origin_date: String,
    pub model: String, // "tft" | "baseline" | "mock"
    pub horizon: Vec<ForecastPoint>,
}

/// Raw row of outputs/forecasts/forecast_table.csv (pipeline schema).
/// Optional fields tolerate schema drift between pipeline versions.
#[derive(Debug, Clone, Deserialize)]
pub struct ForecastRow {
    pub port_id: String,
    pub forecast_origin_date: String,
    pub target_date: String,
    pub horizon_day: i64,
    pub q10: Option<f64>,
    pub q50: Option<f64>,
    pub q90: Option<f64>,
    pub predicted_congestion: Option<f64>,
    pub predicted_delay: Option<f64>,
    pub predicted_throughput: Option<f64>,
    pub risk_level: Option<String>,
    pub confidence_score: Option<f64>,
    #[serde(default)]
    pub model: Option<String>,
}
