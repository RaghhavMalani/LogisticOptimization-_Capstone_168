//! Loads the model-pipeline outputs (CSV) into typed in-memory stores.
//!
//! Design rules:
//!   * NEVER crash on missing/odd files — every table independently falls
//!     back to deterministic mock data and is tagged so the API can report
//!     `data_mode: "mock"` honestly.
//!   * The loader is the ONLY place that touches the filesystem; services
//!     work on typed vectors.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use anyhow::Result;
use serde::de::DeserializeOwned;
use tracing::{info, warn};

use crate::models::*;

/// Static registry of the major Indian ports (used for geo + as mock seed).
pub fn port_registry() -> Vec<Port> {
    let p = |id: &str, name: &str, region: &str, lat: f64, lon: f64, cap: f64,
             berths: u32, conn: f64| Port {
        port_id: id.into(),
        name: name.into(),
        region: region.into(),
        lat,
        lon,
        port_capacity: cap,
        berth_count: berths,
        connectivity_score: conn,
    };
    vec![
        p("DEENDAYAL", "Deendayal (Kandla)", "West", 23.009, 70.216, 1.00, 14, 0.84),
        p("MUNDRA", "Mundra (APSEZ)", "West", 22.763, 69.622, 0.98, 11, 0.85),
        p("JNPT", "Jawaharlal Nehru (Nhava Sheva)", "West", 18.917, 72.940, 0.80, 13, 0.92),
        p("MUMBAI", "Mumbai Port", "West", 18.949, 72.844, 0.45, 10, 0.80),
        p("MORMUGAO", "Mormugao (Goa)", "West", 15.407, 73.802, 0.30, 6, 0.62),
        p("NEW_MANGALORE", "New Mangalore", "West", 12.938, 74.819, 0.42, 7, 0.66),
        p("COCHIN", "Cochin (Vallarpadam)", "South", 9.969, 76.259, 0.45, 6, 0.78),
        p("TUTICORIN", "V.O. Chidambaranar (Tuticorin)", "South", 8.766, 78.189, 0.40, 8, 0.70),
        p("CHENNAI", "Chennai", "East", 13.100, 80.294, 0.55, 8, 0.80),
        p("KAMARAJAR", "Kamarajar (Ennore)", "East", 13.279, 80.339, 0.45, 7, 0.74),
        p("VIZAG", "Visakhapatnam", "East", 17.655, 83.231, 0.72, 9, 0.72),
        p("PARADIP", "Paradip", "East", 20.280, 86.649, 0.85, 9, 0.64),
        p("KOLKATA", "Kolkata / Haldia", "East", 22.536, 88.300, 0.50, 7, 0.65),
    ]
}

/// Everything the API serves, loaded once at startup.
pub struct DataStore {
    pub outputs_dir: PathBuf,
    pub ports: Vec<Port>,
    pub forecasts: Vec<ForecastRow>,
    pub regimes: Vec<RegimeRow>,
    pub panel: Vec<PanelRow>,
    pub events: Vec<EventRow>,
    pub port_reports: Vec<PortReportRow>,
    pub ship_reports: Vec<ShipReportRow>,
    pub routes: Vec<RouteRow>,
    pub league: Vec<LeagueRow>,
    pub anomalies: Vec<AnomalyRow>,
    pub demand: Vec<DemandRow>,
    pub cargo_split: Vec<CargoSplitRow>,
    pub walk_forward: Vec<WalkForwardRow>,
    pub walk_forward_overall: Option<serde_json::Value>,
    /// Which tables came from real files (table name -> bool).
    pub real: BTreeMap<&'static str, bool>,
    /// File-level report for /api/model/status.
    pub files_found: Vec<String>,
    pub files_missing: Vec<String>,
}

impl DataStore {
    pub fn is_real(&self, table: &str) -> bool {
        *self.real.get(table).unwrap_or(&false)
    }
    /// Overall mode: real if the two core tables are real.
    pub fn mode(&self) -> &'static str {
        match (self.is_real("forecasts"), self.is_real("regimes")) {
            (true, true) => "real",
            (false, false) => "mock",
            _ => "partial",
        }
    }
}

pub fn load(outputs_dir: &Path) -> DataStore {
    let mut real = BTreeMap::new();
    let mut found = Vec::new();
    let mut missing = Vec::new();

    // Each dataset may live under more than one historical filename.
    let mut read = |table: &'static str, names: &[&str]| -> Vec<PathBuf> {
        let mut hits = Vec::new();
        for n in names {
            let p = outputs_dir.join(n);
            if p.exists() {
                found.push(n.to_string());
                hits.push(p);
            } else {
                missing.push(n.to_string());
            }
        }
        real.insert(table, !hits.is_empty());
        hits
    };

    let forecasts: Vec<ForecastRow> = read_first(
        &mut read,
        "forecasts",
        &["forecasts/forecast_table.csv", "forecasts/tft_forecasts.csv"],
    );
    let regimes: Vec<RegimeRow> = read_first(
        &mut read,
        "regimes",
        &["regimes/regimes.csv", "regimes/hsmm_regimes.csv"],
    );
    let panel: Vec<PanelRow> = read_first(
        &mut read,
        "panel",
        &["expert_features/merged_panel.csv"],
    );
    let events: Vec<EventRow> = read_first(
        &mut read,
        "events",
        &["forecasts/events.csv"],
    );
    let port_reports: Vec<PortReportRow> = read_first(
        &mut read,
        "port_reports",
        &["forecasts/port_manager_report.csv", "dashboard_exports/port_manager_view.csv"],
    );
    let ship_reports: Vec<ShipReportRow> = read_first(
        &mut read,
        "ship_reports",
        &["forecasts/ship_manager_report.csv", "dashboard_exports/ship_manager_view.csv"],
    );
    let routes: Vec<RouteRow> = read_first(
        &mut read,
        "routes",
        &["forecasts/route_recommendations.csv"],
    );
    let league: Vec<LeagueRow> =
        read_first(&mut read, "league", &["analytics/league_table.csv"]);
    let anomalies: Vec<AnomalyRow> =
        read_first(&mut read, "anomalies", &["analytics/anomalies.csv"]);
    let demand: Vec<DemandRow> =
        read_first(&mut read, "demand", &["analytics/demand_index.csv"]);
    let cargo_split: Vec<CargoSplitRow> =
        read_first(&mut read, "cargo_split", &["analytics/cargo_type_split.csv"]);
    let walk_forward: Vec<WalkForwardRow> = read_first(
        &mut read,
        "walk_forward",
        &["forecasts/walk_forward_metrics.csv"],
    );

    let wf_path = outputs_dir.join("forecasts/walk_forward_overall.json");
    let walk_forward_overall = std::fs::read_to_string(&wf_path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok());
    if walk_forward_overall.is_some() {
        found.push("forecasts/walk_forward_overall.json".into());
    } else {
        missing.push("forecasts/walk_forward_overall.json".into());
    }

    let ports = port_registry();
    let mut store = DataStore {
        outputs_dir: outputs_dir.to_path_buf(),
        ports,
        forecasts,
        regimes,
        panel,
        events,
        port_reports,
        ship_reports,
        routes,
        league,
        anomalies,
        demand,
        cargo_split,
        walk_forward,
        walk_forward_overall,
        real,
        files_found: found,
        files_missing: missing,
    };
    super::mock::fill_missing(&mut store);
    info!(
        "DataStore ready (mode={}, forecasts={}, regimes={}, panel={}, ships={})",
        store.mode(),
        store.forecasts.len(),
        store.regimes.len(),
        store.panel.len(),
        store.routes.len()
    );
    store
}

/// Read the first existing file of `names` as CSV rows of T (empty on failure).
fn read_first<T: DeserializeOwned>(
    read: &mut impl FnMut(&'static str, &[&str]) -> Vec<PathBuf>,
    table: &'static str,
    names: &[&str],
) -> Vec<T> {
    for path in read(table, names) {
        match read_csv::<T>(&path) {
            Ok(rows) if !rows.is_empty() => return rows,
            Ok(_) => warn!("{} is empty", path.display()),
            Err(e) => warn!("failed to parse {}: {e:#}", path.display()),
        }
    }
    Vec::new()
}

fn read_csv<T: DeserializeOwned>(path: &Path) -> Result<Vec<T>> {
    let mut rdr = csv::ReaderBuilder::new()
        .flexible(true)
        .trim(csv::Trim::All)
        .from_path(path)?;
    let mut out = Vec::new();
    for rec in rdr.deserialize::<T>() {
        match rec {
            Ok(row) => out.push(row),
            Err(e) => warn!("bad row in {}: {e}", path.display()),
        }
    }
    Ok(out)
}
