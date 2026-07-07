use serde::{Deserialize, Serialize};

/// One simulated/proxy vessel dot near a port.
#[derive(Debug, Clone, Serialize)]
pub struct VesselDot {
    pub id: String,
    pub name: String,
    pub lat: f64,
    pub lon: f64,
    pub heading: f64,
    pub speed_kn: f64,
    pub status: String, // anchored | approaching | berthed | departing
}

/// Live operational picture of one port (AIS/satellite proxy mode).
#[derive(Debug, Clone, Serialize)]
pub struct PortLive {
    pub port_id: String,
    pub ais_mode: String,
    pub ais_confidence: f64,
    pub generated_at: String,
    pub anchorage: Anchorage,
    pub queue_count: u32,
    pub berth_utilization: f64,
    pub weather_badge: String,
    pub vessels: Vec<VesselDot>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Anchorage {
    pub lat: f64,
    pub lon: f64,
    pub radius_km: f64,
}

/// One expert module's latest verdict for a port (model visibility panel).
#[derive(Debug, Clone, Serialize)]
pub struct ExpertOutput {
    pub expert: String,
    pub input_signal: String, // what raw signal this module consumed
    pub signal: String,       // short verdict
    pub value: f64,           // 0..1 score
    pub confidence: f64,
    pub effect: String,       // effect on the forecast
    pub last_run: String,     // latest feature date / run time
    pub detail: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct Driver {
    pub name: String,
    pub value: f64,
    pub trend: String,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PortIntel {
    pub port_id: String,
    pub drivers: Vec<Driver>,
    pub expert_outputs: Vec<ExpertOutput>,
}

/// WX <PORT>: weather intelligence report (derived from the Weather Expert's
/// risk scores; physical values are approximate inversions, labelled derived).
#[derive(Debug, Clone, Serialize)]
pub struct WxReport {
    pub port_id: String,
    pub mode: String, // "DERIVED FROM WEATHER-EXPERT FEATURES"
    pub as_of: String,
    pub wind_kt: f64,
    pub wind_dir: String,
    pub rainfall_mm: f64,
    pub wave_m: f64,
    pub visibility_km: f64,
    pub cyclone_risk: String, // LOW | WATCH | ACTIVE
    pub weather_persistence: f64, // 7-day mean WxImpactIndex
    pub weather_shock: f64,       // |today - yesterday| impact jump
    pub weather_impact_score: f64,
    pub weather_confidence: f64,
    pub weather_hsmm_input: f64,     // covariate fed to the HSMM
    pub weather_tft_covariate: f64,  // future-known covariate fed to the TFT
}

/// SAR <PORT>: Sentinel-1 / GEE proxy vessel-activity report.
#[derive(Debug, Clone, Serialize)]
pub struct SarReport {
    pub port_id: String,
    pub mode: String, // "SENTINEL-1 / GEE PROXY MODE"
    pub scene_time: String,
    pub vessel_detections: u32,
    pub anchorage_density: f64, // vessels per 100 km^2 of anchorage
    pub queue_zone_activity: f64, // 0..1
    pub change_vs_prev_pct: f64,  // anchorage count vs prior-week mean
    pub sar_confidence: f64,
    pub note: String,
}

/// Raw row of outputs/expert_features/merged_panel.csv (pipeline schema).
#[derive(Debug, Clone, Deserialize)]
pub struct PanelRow {
    pub port_id: String,
    pub date: String,
    pub congestion_index: Option<f64>,
    pub delay_hours: Option<f64>,
    pub throughput: Option<f64>,
    pub utilization: Option<f64>,
    #[serde(rename = "WxImpactIndex")]
    pub wx_impact: Option<f64>,
    pub wind_risk: Option<f64>,
    pub rain_risk: Option<f64>,
    pub wave_risk: Option<f64>,
    pub storm_risk: Option<f64>,
    pub weather_confidence: Option<f64>,
    pub vessel_density: Option<f64>,
    pub anchorage_count: Option<f64>,
    pub arrival_count: Option<f64>,
    pub queue_proxy: Option<f64>,
    pub turnaround_proxy: Option<f64>,
    pub ais_confidence: Option<f64>,
    pub demand_pressure: Option<f64>,
    pub demand_confidence: Option<f64>,
    pub geo_risk_score: Option<f64>,
    pub event_spike_score: Option<f64>,
    pub news_stress: Option<f64>,
}
