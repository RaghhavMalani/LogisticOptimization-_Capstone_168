use serde::{Deserialize, Serialize};

/// One maritime intelligence event (from the GDELT/news pipeline cache).
#[derive(Debug, Clone, Serialize)]
pub struct NewsEvent {
    pub date: String,
    pub headline: String,
    pub source: String,
    pub url: String,
    pub entity: String,      // port / chokepoint / country extracted
    pub event_type: String,  // strike | conflict | storm | policy | blockage | chokepoint
    pub sentiment: f64,      // -1..1
    pub risk_score: f64,     // 0..1
    pub confidence: f64,     // 0..1
    pub affected_ports: Vec<String>,
    pub model_impact: String, // one-line "what this does to the forecast"
}

/// Raw row of outputs/forecasts/events.csv (GDELT connector cache).
#[derive(Debug, Clone, Deserialize)]
pub struct EventRow {
    pub date: Option<String>,
    pub title: Option<String>,
    pub url: Option<String>,
    pub source: Option<String>,
    pub shock_type: Option<String>,
    pub chokepoint: Option<String>,
    pub severity: Option<f64>,
}

/// POST /api/ask request/response.
#[derive(Debug, Clone, Deserialize)]
pub struct AskRequest {
    pub question: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AskAnswer {
    pub question: String,
    pub answer: String,
    pub evidence: Vec<String>, // bullet evidence lines from structured data
    pub method: String,        // "rule-based over model outputs"
}
