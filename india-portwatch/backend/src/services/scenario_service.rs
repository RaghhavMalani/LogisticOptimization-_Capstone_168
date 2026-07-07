//! Event-shock what-if engine.
//!
//! Elasticity-style: each preset defines which ports it touches (by region or
//! chokepoint exposure) and multiplicative shocks on congestion / delay /
//! throughput. Applied to the CURRENT loaded forecast, so scenario deltas are
//! always relative to what the model actually predicts today.

use crate::models::*;
use super::data_loader::DataStore;
use super::forecast_service;

struct Preset {
    id: &'static str,
    name: &'static str,
    description: &'static str,
    category: &'static str,
    /// (ports selector, congestion multiplier, delay multiplier, throughput multiplier)
    scope: Scope,
    congestion_x: f64,
    delay_x: f64,
    throughput_x: f64,
    response: &'static [&'static str],
}

enum Scope {
    Region(&'static str),
    Ports(&'static [&'static str]),
    All,
}

const PRESETS: &[Preset] = &[
    Preset {
        id: "storm_west_coast",
        name: "Storm near west coast",
        description: "Severe monsoon storm cell tracking along the Arabian Sea coast.",
        category: "weather",
        scope: Scope::Region("West"),
        congestion_x: 1.35, delay_x: 1.6, throughput_x: 0.8,
        response: &[
            "Suspend outer-anchorage transfers at affected west-coast ports.",
            "Pre-announce weather buffers to inbound vessels (12-24 h).",
            "Shift discretionary cargo to east-coast gateways where feasible.",
        ],
    },
    Preset {
        id: "cyclone_east_coast",
        name: "Cyclone near east coast",
        description: "Bay of Bengal cyclone approaching the Chennai-Vizag corridor.",
        category: "weather",
        scope: Scope::Ports(&["CHENNAI", "KAMARAJAR", "VIZAG", "PARADIP", "KOLKATA"]),
        congestion_x: 1.55, delay_x: 2.0, throughput_x: 0.6,
        response: &[
            "Activate cyclone protocol: clear anchorage, secure cranes.",
            "Hold vessel arrivals 48-72 h; stage recovery berthing plan.",
            "Coordinate with IMD advisories for reopening windows.",
        ],
    },
    Preset {
        id: "labor_strike",
        name: "Labour strike",
        description: "Port workers' strike reducing gate and yard operations.",
        category: "labour",
        scope: Scope::All,
        congestion_x: 1.3, delay_x: 1.7, throughput_x: 0.7,
        response: &[
            "Prioritise perishable and hazardous cargo through limited gangs.",
            "Negotiate essential-operations agreement for liner windows.",
            "Advise carriers of revised free-time and demurrage terms.",
        ],
    },
    Preset {
        id: "capacity_drop",
        name: "Port capacity drop",
        description: "Unplanned berth/crane outage removing ~20% of handling capacity.",
        category: "capacity",
        scope: Scope::All,
        congestion_x: 1.25, delay_x: 1.5, throughput_x: 0.8,
        response: &[
            "Rebalance vessel line-up across remaining berths by priority score.",
            "Extend gate hours to clear yard backlog.",
        ],
    },
    Preset {
        id: "demand_surge",
        name: "Demand surge",
        description: "Festival/quarter-end cargo surge (+15% demand).",
        category: "demand",
        scope: Scope::All,
        congestion_x: 1.15, delay_x: 1.25, throughput_x: 1.1,
        response: &[
            "Open overflow yard capacity and pre-stage empties.",
            "Coordinate rail evacuation slots with hinterland operators.",
        ],
    },
    Preset {
        id: "hormuz_closure",
        name: "Hormuz closure",
        description: "Strait of Hormuz closed: Gulf crude/LNG flows to west-coast ports halt.",
        category: "chokepoint",
        scope: Scope::Ports(&["MUNDRA", "DEENDAYAL", "JNPT", "MUMBAI", "COCHIN", "NEW_MANGALORE"]),
        congestion_x: 1.2, delay_x: 1.4, throughput_x: 0.65,
        response: &[
            "Expect tanker congestion unwinding at west-coast energy terminals.",
            "Re-sequence liquid-bulk berths; prioritise strategic reserves.",
            "Monitor freight-rate and bunker-cost pass-through.",
        ],
    },
    Preset {
        id: "red_sea_disruption",
        name: "Red Sea disruption",
        description: "Bab-el-Mandeb/Suez transits collapse; Europe trade reroutes via Cape.",
        category: "chokepoint",
        scope: Scope::Ports(&["JNPT", "MUNDRA", "MUMBAI", "COCHIN", "CHENNAI", "TUTICORIN"]),
        congestion_x: 1.18, delay_x: 1.35, throughput_x: 0.85,
        response: &[
            "Add ~12 days to Europe rotations; rebuild vessel schedules.",
            "Expect blank sailings — smooth yard utilisation accordingly.",
            "Watch war-risk premium impact on export bookings.",
        ],
    },
    Preset {
        id: "fuel_price_shock",
        name: "Fuel price shock",
        description: "Brent spikes ~25%: bunker costs surge, slow-steaming spreads, demand softens.",
        category: "market",
        scope: Scope::All,
        congestion_x: 1.08, delay_x: 1.15, throughput_x: 0.92,
        response: &[
            "Expect slow-steaming: add 6-12 h to ETAs on long hauls.",
            "Re-price demurrage exposure; bunker surcharges pass through in 1-2 weeks.",
            "Prioritise high-value cargo if carriers cut marginal sailings.",
        ],
    },
];

pub fn presets() -> Vec<ScenarioPreset> {
    PRESETS
        .iter()
        .map(|p| ScenarioPreset {
            id: p.id.into(),
            name: p.name.into(),
            description: p.description.into(),
            category: p.category.into(),
        })
        .collect()
}

fn risk_label(c: f64) -> String {
    if c >= 75.0 {
        "CRITICAL".into()
    } else if c >= 60.0 {
        "HIGH".into()
    } else if c >= 45.0 {
        "MEDIUM".into()
    } else {
        "LOW".into()
    }
}

pub fn simulate(store: &DataStore, req: &SimulateRequest) -> Option<ScenarioResult> {
    let preset = PRESETS.iter().find(|p| p.id == req.scenario_id)?;
    let intensity = req.intensity.clamp(0.5, 2.0);
    // Scale multiplicative shocks by intensity (1.0 = calibrated default).
    let scale = |x: f64| 1.0 + (x - 1.0) * intensity;
    let (cx, dx, tx) = (
        scale(preset.congestion_x),
        scale(preset.delay_x),
        scale(preset.throughput_x),
    );

    let mut impacts = Vec::new();
    for port in &store.ports {
        let in_scope = match &preset.scope {
            Scope::All => true,
            Scope::Region(r) => port.region == *r,
            Scope::Ports(ids) => ids.contains(&port.port_id.as_str()),
        };
        if !in_scope {
            continue;
        }
        let Some(fc) = forecast_service::port_forecast(store, &port.port_id) else {
            continue;
        };
        // Impact measured at the 5-day mark (mid-horizon), the planning point.
        let Some(mid) = fc.horizon.iter().find(|h| h.day == 5).or(fc.horizon.last())
        else {
            continue;
        };
        let base_c = mid.congestion_q50;
        let new_c = (base_c * cx).clamp(0.0, 100.0);
        let base_d = mid.delay_hours;
        let new_d = base_d * dx;
        impacts.push(PortImpact {
            port_id: port.port_id.clone(),
            port_name: port.name.clone(),
            lat: port.lat,
            lon: port.lon,
            baseline_congestion: round1(base_c),
            scenario_congestion: round1(new_c),
            congestion_delta: round1(new_c - base_c),
            baseline_delay_hours: round1(base_d),
            scenario_delay_hours: round1(new_d),
            delay_delta_hours: round1(new_d - base_d),
            throughput_change_pct: round1((tx - 1.0) * 100.0),
            risk_before: risk_label(base_c),
            risk_after: risk_label(new_c),
        });
    }
    impacts.sort_by(|a, b| b.congestion_delta.total_cmp(&a.congestion_delta));

    let escalated = impacts
        .iter()
        .filter(|i| i.risk_after != i.risk_before)
        .count();
    let worst = impacts.first();
    let national_summary = match worst {
        Some(w) => format!(
            "{}: {} port(s) affected, {} escalate risk level. Worst hit: {} \
             (congestion {:.0} → {:.0}, delay {:+.1} h, throughput {:+.0}%).",
            preset.name,
            impacts.len(),
            escalated,
            w.port_name,
            w.baseline_congestion,
            w.scenario_congestion,
            w.delay_delta_hours,
            w.throughput_change_pct
        ),
        None => format!("{}: no ports in scope with forecasts.", preset.name),
    };

    Some(ScenarioResult {
        scenario_id: preset.id.into(),
        scenario_name: preset.name.into(),
        intensity,
        affected_ports: impacts,
        national_summary,
        recommended_response: preset.response.iter().map(|s| s.to_string()).collect(),
    })
}

fn round1(x: f64) -> f64 {
    (x * 10.0).round() / 10.0
}
