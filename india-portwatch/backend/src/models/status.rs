use serde::{Deserialize, Serialize};

/// One stage of DATA → EXPERTS → HSMM → TFT → DECISION → ANALYTICS.
#[derive(Debug, Clone, Serialize)]
pub struct StageStatus {
    pub stage: String,
    pub status: String, // ok | degraded | missing
    pub latest_run: Option<String>,
    pub files_found: Vec<String>,
    pub files_missing: Vec<String>,
    pub records: usize,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ModelStatus {
    pub pipeline: Vec<StageStatus>,
    pub data_mode: String,
    pub outputs_dir: String,
    pub walk_forward: Option<serde_json::Value>,
}

/// Raw row of outputs/forecasts/port_manager_report.csv.
#[derive(Debug, Clone, Deserialize)]
pub struct PortReportRow {
    pub port_id: String,
    pub port_name: Option<String>,
    pub current_regime: Option<String>,
    pub days_in_state: Option<f64>,
    pub expected_remaining_days: Option<f64>,
    pub transition_risk: Option<f64>,
    pub peak_congestion_day: Option<i64>,
    pub peak_congestion_q50: Option<f64>,
    pub peak_congestion_q90: Option<f64>,
    pub peak_delay_hours: Option<f64>,
    pub mean_throughput: Option<f64>,
    pub weather_impact: Option<String>,
    pub capacity_risk: Option<String>,
    pub high_risk_horizon_days: Option<String>,
    pub recommended_action: Option<String>,
}

/// Generic analytics rows (league table / KPIs / anomalies / demand).
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LeagueRow {
    pub port_id: String,
    pub port_name: Option<String>,
    pub region: Option<String>,
    pub cargo_mt: Option<f64>,
    pub containers_teu: Option<f64>,
    pub capacity_utilization: Option<f64>,
    pub turnaround_days: Option<f64>,
    pub efficiency_score: Option<f64>,
    pub throughput_rank: Option<f64>,
    pub efficiency_rank: Option<f64>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AnomalyRow {
    pub port_id: String,
    pub date: Option<String>,
    pub metric: Option<String>,
    pub value: Option<f64>,
    pub zscore: Option<f64>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct DemandRow {
    pub port_id: String,
    pub port_name: Option<String>,
    pub demand_index: Option<f64>,
    pub yoy_growth_pct: Option<f64>,
    pub utilization: Option<f64>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CargoSplitRow {
    pub port_id: String,
    pub containerised: Option<f64>,
    pub dry_bulk: Option<f64>,
    pub liquid_bulk: Option<f64>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct WalkForwardRow {
    pub fold: Option<i64>,
    pub train_end: Option<String>,
    pub test_end: Option<String>,
    pub n_test: Option<i64>,
    pub mae: Option<f64>,
    pub rmse: Option<f64>,
    pub mape_pct: Option<f64>,
    pub pinball_q50: Option<f64>,
    pub coverage_80pct: Option<f64>,
    pub coverage_80pct_cal: Option<f64>,
}
