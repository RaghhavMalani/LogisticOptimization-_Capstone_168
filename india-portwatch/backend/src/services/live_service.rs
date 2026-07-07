//! Live proxy picture + per-port model intel + WX / SAR terminal reports.
//!
//! Vessel dots and SAR detections are deterministic simulations SEEDED BY THE
//! REAL latest expert features; physical weather values are approximate
//! inversions of the Weather Expert's risk scores. All of it is labelled
//! proxy/derived in the API — the terminal must never pretend it is measured.

use chrono::Utc;

use crate::models::*;
use super::data_loader::DataStore;
use super::regime_service;

fn noise(seed: &str, i: i64) -> f64 {
    let mut h: u64 = 1469598103934665603;
    for b in seed.bytes() {
        h ^= b as u64;
        h = h.wrapping_mul(1099511628211);
    }
    h ^= i as u64;
    h = h.wrapping_mul(1099511628211);
    (h % 10_000) as f64 / 10_000.0
}

pub fn latest_panel<'a>(store: &'a DataStore, port_id: &str) -> Option<&'a PanelRow> {
    store.panel.iter()
        .filter(|r| r.port_id.eq_ignore_ascii_case(port_id))
        .max_by(|a, b| a.date.cmp(&b.date))
}

fn panel_history<'a>(store: &'a DataStore, port_id: &str) -> Vec<&'a PanelRow> {
    let mut rows: Vec<&PanelRow> = store.panel.iter()
        .filter(|r| r.port_id.eq_ignore_ascii_case(port_id))
        .collect();
    rows.sort_by(|a, b| a.date.cmp(&b.date));
    rows
}

fn queue_trend(store: &DataStore, port_id: &str) -> (String, f64) {
    let rows = panel_history(store, port_id);
    let q: Vec<f64> = rows.iter().filter_map(|r| r.queue_proxy).collect();
    if q.len() < 5 { return ("stable".into(), 0.0); }
    let recent = q[q.len() - 3..].iter().sum::<f64>() / 3.0;
    let n_prior = q.len().min(10) - 3;
    let prior = q[q.len() - 3 - n_prior..q.len() - 3].iter().sum::<f64>() / n_prior.max(1) as f64;
    let d = recent - prior;
    ((if d > 0.03 { "rising" } else if d < -0.03 { "falling" } else { "stable" }).into(), d)
}

fn sea_bearing(region: &str) -> f64 {
    match region { "West" => 245.0, "South" => 200.0, _ => 125.0 }
}

fn offset(lat: f64, lon: f64, bearing_deg: f64, km: f64) -> (f64, f64) {
    let b = bearing_deg.to_radians();
    (lat + (km / 110.6) * b.cos(),
     lon + (km / (111.3 * lat.to_radians().cos())) * b.sin())
}

const SHIP_PREFIX: &[&str] = &["MV", "MT", "MSC", "CMA", "SCI"];
const SHIP_NAMES: &[&str] = &[
    "Nicobar", "Malabar", "Konkan", "Coromandel", "Saurashtra", "Ganga",
    "Godavari", "Krishna", "Kaveri", "Tapti", "Narmada", "Brahmaputra",
    "Arabian Star", "Bengal Pearl", "Deccan", "Sahyadri", "Kutch", "Chola",
];

pub fn port_live(store: &DataStore, port: &Port) -> PortLive {
    let panel = latest_panel(store, &port.port_id);
    let pid = &port.port_id;
    let queue = panel.and_then(|p| p.anchorage_count)
        .unwrap_or_else(|| 2.0 + 5.0 * noise(pid, 1)).round().max(0.0) as u32;
    let density = panel.and_then(|p| p.vessel_density)
        .unwrap_or_else(|| 8.0 + 8.0 * noise(pid, 2));
    let util = panel.and_then(|p| p.utilization)
        .unwrap_or_else(|| 0.5 + 0.4 * noise(pid, 3)).clamp(0.0, 1.0);
    let wx = panel.and_then(|p| p.wx_impact).unwrap_or(0.15);
    let ais_conf = panel.and_then(|p| p.ais_confidence).unwrap_or(0.5);

    let bearing = sea_bearing(&port.region);
    let (alat, alon) = offset(port.lat, port.lon, bearing, 14.0);
    let n_berthed = (1.0 + util * 4.0).round() as usize;
    let n_anchored = queue as usize;
    let n_moving = (2.0 + density / 6.0).round() as usize;

    let mut vessels = Vec::new();
    let mut idx = 0i64;
    let mut push = |status: &str, lat: f64, lon: f64, heading: f64, speed: f64,
                    idx: i64, vessels: &mut Vec<VesselDot>| {
        let name = format!("{} {}",
            SHIP_PREFIX[(noise(pid, 100 + idx) * SHIP_PREFIX.len() as f64) as usize % SHIP_PREFIX.len()],
            SHIP_NAMES[(noise(pid, 200 + idx) * SHIP_NAMES.len() as f64) as usize % SHIP_NAMES.len()]);
        vessels.push(VesselDot {
            id: format!("{}-{}", pid.to_lowercase(), idx), name,
            lat: (lat * 1e5).round() / 1e5, lon: (lon * 1e5).round() / 1e5,
            heading: (heading * 10.0).round() / 10.0,
            speed_kn: (speed * 10.0).round() / 10.0, status: status.into(),
        });
    };
    for _ in 0..n_anchored {
        idx += 1;
        let ang = 360.0 * noise(pid, 300 + idx);
        let r = 2.0 + 6.0 * noise(pid, 400 + idx);
        let (la, lo) = offset(alat, alon, ang, r);
        push("anchored", la, lo, ang, 0.0, idx, &mut vessels);
    }
    for _ in 0..n_berthed {
        idx += 1;
        let (la, lo) = offset(port.lat, port.lon, bearing, 0.6 + 0.8 * noise(pid, 500 + idx));
        push("berthed", la, lo, 0.0, 0.0, idx, &mut vessels);
    }
    for _ in 0..n_moving {
        idx += 1;
        let inbound = noise(pid, 600 + idx) > 0.4;
        let dist = 20.0 + 35.0 * noise(pid, 700 + idx);
        let spread = bearing + (noise(pid, 800 + idx) - 0.5) * 60.0;
        let (la, lo) = offset(port.lat, port.lon, spread, dist);
        let heading = if inbound { (spread + 180.0) % 360.0 } else { spread };
        push(if inbound { "approaching" } else { "departing" },
             la, lo, heading, 8.0 + 6.0 * noise(pid, 900 + idx), idx, &mut vessels);
    }

    PortLive {
        port_id: port.port_id.clone(),
        ais_mode: "proxy".into(),
        ais_confidence: (ais_conf * 100.0).round() / 100.0,
        generated_at: Utc::now().format("%Y-%m-%d %H:%M:%SZ").to_string(),
        anchorage: Anchorage { lat: alat, lon: alon, radius_km: 9.0 },
        queue_count: queue,
        berth_utilization: (util * 100.0).round() / 100.0,
        weather_badge: if wx >= 0.6 { "HIGH" } else if wx >= 0.3 { "MODERATE" } else { "LOW" }.into(),
        vessels,
    }
}

pub fn national_live(store: &DataStore) -> Vec<PortLive> {
    store.ports.iter().map(|p| port_live(store, p)).collect()
}

fn level(v: f64, lo: f64, hi: f64, labels: [&str; 3]) -> String {
    if v >= hi { labels[2] } else if v >= lo { labels[1] } else { labels[0] }.to_string()
}

fn r2(x: f64) -> f64 { (x * 100.0).round() / 100.0 }
fn r1(x: f64) -> f64 { (x * 10.0).round() / 10.0 }

/// Approximate inverse of the expert's logistic risk transform.
fn inv_logistic(risk: f64, center: f64, scale: f64) -> f64 {
    let r = risk.clamp(0.02, 0.98);
    center + scale * (r / (1.0 - r)).ln()
}

/// WX <PORT>: weather terminal report.
pub fn wx_report(store: &DataStore, port: &Port) -> WxReport {
    let hist = panel_history(store, &port.port_id);
    let last = hist.last().copied();
    let wx = last.and_then(|p| p.wx_impact).unwrap_or(0.15);
    let wind_r = last.and_then(|p| p.wind_risk).unwrap_or(0.2);
    let rain_r = last.and_then(|p| p.rain_risk).unwrap_or(0.15);
    let wave_r = last.and_then(|p| p.wave_risk).unwrap_or(wind_r);
    let storm = last.and_then(|p| p.storm_risk).unwrap_or(0.0);
    let conf = last.and_then(|p| p.weather_confidence).unwrap_or(0.5);
    let as_of = last.map(|p| p.date.clone()).unwrap_or_default();

    let n = hist.len();
    let persistence = if n >= 2 {
        let tail = &hist[n.saturating_sub(7)..];
        tail.iter().filter_map(|p| p.wx_impact).sum::<f64>() / tail.len().max(1) as f64
    } else { wx };
    let shock = if n >= 2 {
        (wx - hist[n - 2].wx_impact.unwrap_or(wx)).abs()
    } else { 0.0 };

    let wind_dir = match port.region.as_str() {
        "West" => "WSW", "South" => "SW", _ => "NE",
    };
    WxReport {
        port_id: port.port_id.clone(),
        mode: "DERIVED FROM WEATHER-EXPERT FEATURES (wire Open-Meteo for measured values)".into(),
        as_of,
        wind_kt: r1(inv_logistic(wind_r, 25.0, 6.0).clamp(3.0, 60.0)),
        wind_dir: wind_dir.into(),
        rainfall_mm: r1(inv_logistic(rain_r, 25.0, 12.0).clamp(0.0, 180.0)),
        wave_m: r1(inv_logistic(wave_r, 2.0, 0.7).clamp(0.2, 7.0)),
        visibility_km: r1((10.0 - 7.0 * storm).clamp(1.0, 10.0)),
        cyclone_risk: if storm >= 0.7 { "ACTIVE" } else if storm >= 0.35 { "WATCH" } else { "LOW" }.into(),
        weather_persistence: r2(persistence),
        weather_shock: r2(shock),
        weather_impact_score: r2(wx),
        weather_confidence: r2(conf),
        weather_hsmm_input: r2(wx),
        weather_tft_covariate: r2(wx), // future-known covariate at forecast origin
    }
}

/// SAR <PORT>: Sentinel-1 / GEE proxy report.
pub fn sar_report(store: &DataStore, port: &Port) -> SarReport {
    let hist = panel_history(store, &port.port_id);
    let last = hist.last().copied();
    let anch = last.and_then(|p| p.anchorage_count).unwrap_or(3.0);
    let queue = last.and_then(|p| p.queue_proxy).unwrap_or(0.4);
    let dens = last.and_then(|p| p.vessel_density).unwrap_or(8.0);
    let conf = last.and_then(|p| p.ais_confidence).unwrap_or(0.5);
    let n = hist.len();
    let prev_mean = if n > 8 {
        let w = &hist[n - 8..n - 1];
        w.iter().filter_map(|p| p.anchorage_count).sum::<f64>() / w.len().max(1) as f64
    } else { anch };
    let change = if prev_mean > 0.0 { (anch - prev_mean) / prev_mean * 100.0 } else { 0.0 };
    let area = std::f64::consts::PI * 9.0 * 9.0; // anchorage radius 9 km

    SarReport {
        port_id: port.port_id.clone(),
        mode: "SENTINEL-1 / GEE PROXY MODE".into(),
        scene_time: last.map(|p| p.date.clone()).unwrap_or_default(),
        vessel_detections: (dens.round().max(0.0)) as u32,
        anchorage_density: r1(anch / area * 100.0),
        queue_zone_activity: r2(queue),
        change_vs_prev_pct: r1(change),
        sar_confidence: r2(conf),
        note: "Detections are simulated from PortWatch satellite-AIS aggregates; \
               wire GEE Sentinel-1 ship detection to go real.".into(),
    }
}

/// Drivers + expert-module outputs ("why is the model saying this").
pub fn port_intel(store: &DataStore, port: &Port) -> PortIntel {
    let panel = latest_panel(store, &port.port_id);
    let (trend, delta) = queue_trend(store, &port.port_id);
    let regime = regime_service::current_state(store, &port.port_id);
    let last_run = panel.map(|p| p.date.clone()).unwrap_or_default();

    let queue = panel.and_then(|p| p.queue_proxy).unwrap_or(0.4);
    let wx = panel.and_then(|p| p.wx_impact).unwrap_or(0.15);
    let wx_conf = panel.and_then(|p| p.weather_confidence).unwrap_or(0.5);
    let demand = panel.and_then(|p| p.demand_pressure).unwrap_or(0.5);
    let demand_conf = panel.and_then(|p| p.demand_confidence).unwrap_or(0.5);
    let util = panel.and_then(|p| p.utilization).unwrap_or(0.6).clamp(0.0, 1.0);
    let geo = panel.and_then(|p| p.geo_risk_score).unwrap_or(0.15);
    let ais_conf = panel.and_then(|p| p.ais_confidence).unwrap_or(0.5);
    let spike = panel.and_then(|p| p.event_spike_score).unwrap_or(0.0);

    let mut drivers = vec![
        Driver { name: format!("Vessel queue pressure {trend}"), value: queue.clamp(0.0, 1.0),
            trend: trend.clone(),
            detail: format!("Queue proxy at {:.0}% of range ({}{:.0}% vs prior week).",
                queue * 100.0, if delta >= 0.0 { "+" } else { "" }, delta * 100.0) },
        Driver { name: format!("Weather risk {}", level(wx, 0.3, 0.6, ["low", "moderate", "high"])),
            value: wx.clamp(0.0, 1.0), trend: "stable".into(),
            detail: format!("WxImpactIndex {:.2} (0-1 scale).", wx) },
        Driver { name: format!("Demand pressure {}", level(demand, 0.45, 0.65, ["low", "moderate", "high"])),
            value: demand.clamp(0.0, 1.0), trend: "stable".into(),
            detail: format!("Trade-demand expert index {:.2}.", demand) },
        Driver { name: format!("Capacity utilisation {}", level(util, 0.6, 0.8, ["comfortable", "high", "critical"])),
            value: util, trend: "stable".into(),
            detail: format!("Berth/handling utilisation ~{:.0}%.", util * 100.0) },
        Driver { name: if geo < 0.3 { "No major geopolitical shock near this port".into() }
                       else { format!("Geopolitical/event risk {}", level(geo, 0.3, 0.6, ["low", "elevated", "severe"])) },
            value: geo.clamp(0.0, 1.0),
            trend: if spike > 0.5 { "rising".into() } else { "stable".into() },
            detail: format!("Geo-risk {:.2}; event spike {:.2}.", geo, spike) },
    ];
    drivers.sort_by(|a, b| b.value.total_cmp(&a.value));

    let mk = |expert: &str, input_signal: &str, signal: String, value: f64,
              confidence: f64, effect: String, detail: &str| ExpertOutput {
        expert: expert.into(), input_signal: input_signal.into(), signal, value,
        confidence: r2(confidence), effect, last_run: last_run.clone(),
        detail: detail.into(),
    };

    let expert_outputs = vec![
        mk("Weather Expert", "wind / rain / wave / storm fields",
           format!("{} impact", level(wx, 0.3, 0.6, ["Low", "Moderate", "High"])),
           wx.clamp(0.0, 1.0), wx_conf,
           format!("WxImpactIndex {:.2} raises congestion covariate", wx),
           "Physical weather fused into a 0-1 impact index."),
        mk("News / NLP Expert", "GDELT headlines + GDACS alerts",
           format!("{} event risk", level(geo, 0.3, 0.6, ["Low", "Moderate", "Elevated"])),
           geo.clamp(0.0, 1.0), 0.65,
           format!("geo_risk {:.2} feeds regime transition pressure", geo),
           "Strike / policy / conflict channels with time-decayed events."),
        mk("SAR / AIS Proxy Expert", "PortWatch satellite-AIS daily aggregates",
           format!("Queue pressure {trend}"),
           queue.clamp(0.0, 1.0), ais_conf,
           format!("queue_proxy {:.2} is the HSMM's core emission", queue),
           "Port calls vs the port's own strictly-backward baseline."),
        mk("Demand Expert", "monthly trade volumes (leakage-safe daily)",
           format!("{} demand pressure", level(demand, 0.45, 0.65, ["Low", "Moderate", "High"])),
           demand.clamp(0.0, 1.0), demand_conf,
           format!("demand_pressure {:.2} scales throughput forecast", demand),
           "Interpolation / distribution behind a publication lag."),
        mk("HSMM Regime", "expert feature panel",
           regime.as_ref().map(|r| format!("{} - transition risk {:.0}%",
               r.current_regime, r.transition_risk * 100.0)).unwrap_or_else(|| "No state".into()),
           regime.as_ref().map(|r| r.p_congested + r.p_severe).unwrap_or(0.0),
           regime.as_ref().map(|r| match r.confidence.as_str() {
               "HIGH" => 0.85, "MEDIUM" => 0.65, _ => 0.4 }).unwrap_or(0.5),
           regime.as_ref().map(|r| format!("state + {:.1}d expected dwell feed the TFT",
               r.expected_remaining_days)).unwrap_or_default(),
           "Hidden semi-Markov state with expected dwell time."),
    ];

    PortIntel { port_id: port.port_id.clone(), drivers, expert_outputs }
}
