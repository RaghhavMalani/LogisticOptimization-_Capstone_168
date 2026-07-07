//! News / NLP intelligence + the rule-based "Ask PortWatch" answerer.
//!
//! Events come from the REAL GDELT connector cache (outputs/forecasts/
//! events.csv: title/source/shock_type/chokepoint/severity). We enrich each
//! event with extracted entity, event type, sentiment/risk, and the Indian
//! ports it touches (via chokepoint exposure). If the cache is missing we
//! fall back to clearly-labelled demo events.
//!
//! "Ask PortWatch" is intentionally NOT an LLM: it pattern-matches the
//! question and answers from the loaded model outputs, quoting evidence.

use crate::models::*;
use super::data_loader::DataStore;
use super::{forecast_service, live_service, port_service, regime_service,
            scenario_service, ship_service};

fn chokepoint_ports(cp: &str) -> Vec<&'static str> {
    match cp.to_uppercase().as_str() {
        "HORMUZ" => vec!["MUNDRA", "DEENDAYAL", "JNPT", "MUMBAI", "COCHIN", "NEW_MANGALORE"],
        "BAB_EL_MANDEB" | "SUEZ" | "RED_SEA" =>
            vec!["JNPT", "MUNDRA", "MUMBAI", "COCHIN", "CHENNAI", "TUTICORIN"],
        "MALACCA" => vec!["CHENNAI", "KAMARAJAR", "VIZAG", "PARADIP", "KOLKATA"],
        _ => vec![],
    }
}

fn event_type_of(shock: &str) -> &'static str {
    let s = shock.to_lowercase();
    if s.contains("strike") || s.contains("labor") || s.contains("labour") { "strike" }
    else if s.contains("storm") || s.contains("cyclone") || s.contains("weather") { "storm" }
    else if s.contains("conflict") || s.contains("attack") || s.contains("war") { "conflict" }
    else if s.contains("policy") || s.contains("tariff") || s.contains("sanction") { "policy" }
    else if s.contains("closure") || s.contains("block") { "blockage" }
    else { "chokepoint" }
}

fn enrich(row: &EventRow, real: bool) -> NewsEvent {
    let sev = row.severity.unwrap_or(0.4).clamp(0.0, 1.0);
    let cp = row.chokepoint.clone().unwrap_or_default();
    let affected: Vec<String> =
        chokepoint_ports(&cp).iter().map(|s| s.to_string()).collect();
    let etype = event_type_of(row.shock_type.as_deref().unwrap_or(""));
    NewsEvent {
        date: row.date.clone().unwrap_or_default(),
        headline: row.title.clone().unwrap_or_else(|| "(untitled)".into()),
        source: row.source.clone().unwrap_or_default(),
        url: row.url.clone().unwrap_or_default(),
        entity: if cp.is_empty() { "India maritime".into() } else { cp },
        event_type: etype.into(),
        sentiment: (-(sev * 0.8) * 100.0).round() / 100.0,
        risk_score: (sev * 100.0).round() / 100.0,
        confidence: if real { 0.7 } else { 0.5 },
        affected_ports: affected,
        model_impact: match etype {
            "storm" => "storm_risk ↑ → WxImpactIndex ↑ → congestion forecast ↑".into(),
            "strike" => "strike_risk ↑ → geo_risk_score ↑ → delay buffer ↑".into(),
            "blockage" | "chokepoint" =>
                "chokepoint exposure ↑ → freight risk ↑ → arrival buffers ↑".into(),
            "conflict" => "conflict_risk ↑ → event_spike ↑ → regime transition risk ↑".into(),
            _ => "policy_risk ↑ → demand/trade adjustment".into(),
        },
    }
}

fn demo_events() -> Vec<EventRow> {
    let mk = |t: &str, cp: &str, st: &str, sev: f64| EventRow {
        date: Some("(demo)".into()),
        title: Some(t.into()),
        url: Some(String::new()),
        source: Some("demo feed".into()),
        shock_type: Some(st.into()),
        chokepoint: Some(cp.into()),
        severity: Some(sev),
    };
    vec![
        mk("Red Sea transits remain suppressed; carriers hold Cape routings",
           "BAB_EL_MANDEB", "chokepoint_closure", 0.8),
        mk("Tanker bunching reported off Strait of Hormuz after inspection delays",
           "HORMUZ", "congestion", 0.55),
        mk("Monsoon system intensifying over the Arabian Sea", "", "storm", 0.5),
        mk("Port workers union announces wage talks deadline", "", "strike_watch", 0.4),
    ]
}

pub fn national(store: &DataStore) -> (Vec<NewsEvent>, bool) {
    let real = !store.events.is_empty();
    let rows: Vec<EventRow> = if real {
        store.events.clone()
    } else {
        demo_events()
    };
    let mut out: Vec<NewsEvent> = rows.iter().map(|r| enrich(r, real)).collect();
    // Dedupe by headline, keep highest risk first, cap the feed.
    out.sort_by(|a, b| b.risk_score.total_cmp(&a.risk_score));
    out.dedup_by(|a, b| a.headline == b.headline);
    out.truncate(20);
    (out, real)
}

pub fn for_port(store: &DataStore, port_id: &str) -> (Vec<NewsEvent>, bool) {
    let (all, real) = national(store);
    let pid = port_id.to_uppercase();
    let hits: Vec<NewsEvent> = all
        .iter()
        .filter(|e| e.affected_ports.iter().any(|p| p == &pid))
        .cloned()
        .take(6)
        .collect();
    (hits, real)
}

// ---------------------------------------------------------------------------
// Ask PortWatch (rule-based QA over structured model outputs)
// ---------------------------------------------------------------------------
pub fn ask(store: &DataStore, question: &str) -> AskAnswer {
    let q = question.to_lowercase();
    let port = store.ports.iter().find(|p| {
        q.contains(&p.port_id.to_lowercase())
            || q.contains(&p.name.to_lowercase())
            || p.name.split(['(', ')', '/']).any(|part| {
                let t = part.trim().to_lowercase();
                t.len() > 3 && q.contains(&t)
            })
    });
    let vessel = store.routes.iter().find(|r| {
        let n = r.vessel.to_lowercase();
        q.contains(&n) || n.split_whitespace().last().map_or(false, |w| q.contains(w))
    });

    // 1) Vessel arrival questions.
    if let Some(v) = vessel {
        if let Some(rec) = ship_service::recommendation(store, &ship_service::slug(&v.vessel)) {
            return AskAnswer {
                question: question.into(),
                answer: format!(
                    "{}: best arrival window is Day +{} at {} with a {} h buffer. {}",
                    rec.ship.name, rec.ship.best_arrival_day, rec.ship.recommended_port,
                    rec.ship.recommended_buffer_hours, rec.reason
                ),
                evidence: vec![
                    format!("berth waiting risk: {}", rec.ship.berth_waiting_risk),
                    format!("port entry risk: {}", rec.ship.port_entry_risk),
                    format!("confidence: {}", rec.ship.confidence),
                ],
                method: "rule-based over decision-layer outputs".into(),
            };
        }
    }

    // 2) Scenario exposure questions.
    let scen = [
        ("hormuz", "hormuz_closure"), ("red sea", "red_sea_disruption"),
        ("suez", "red_sea_disruption"), ("cyclone", "cyclone_east_coast"),
        ("storm", "storm_west_coast"), ("strike", "labor_strike"),
        ("capacity", "capacity_drop"), ("demand", "demand_surge"),
        ("fuel", "fuel_price_shock"), ("oil price", "fuel_price_shock"),
    ]
    .iter()
    .find(|(k, _)| q.contains(k));
    if let Some((_, sid)) = scen {
        if q.contains("exposed") || q.contains("impact") || q.contains("what happens")
            || q.contains("which ports") || q.contains("affect") {
            let req = SimulateRequest { scenario_id: sid.to_string(), intensity: 1.0 };
            if let Some(r) = scenario_service::simulate(store, &req) {
                let top: Vec<String> = r.affected_ports.iter().take(3)
                    .map(|p| format!("{}: +{:.0} congestion, +{:.1} h delay",
                                     p.port_name, p.congestion_delta, p.delay_delta_hours))
                    .collect();
                return AskAnswer {
                    question: question.into(),
                    answer: format!("{} Most exposed: {}.",
                                    r.national_summary,
                                    r.affected_ports.iter().take(3)
                                        .map(|p| p.port_id.clone())
                                        .collect::<Vec<_>>().join(", ")),
                    evidence: top,
                    method: "scenario engine over live forecast".into(),
                };
            }
        }
    }

    // 3) "Why is <port> risky" questions.
    if let Some(p) = port {
        let intel = live_service::port_intel(store, p);
        let regime = regime_service::current_state(store, &p.port_id);
        let fc = forecast_service::port_forecast(store, &p.port_id);
        let peak = fc.as_ref().and_then(|f| f.horizon.iter()
            .max_by(|a, b| a.congestion_q50.total_cmp(&b.congestion_q50)).cloned());
        let top: Vec<String> = intel.drivers.iter().take(3)
            .map(|d| format!("{} ({:.0}%)", d.name, d.value * 100.0)).collect();
        let r = regime.as_ref();
        return AskAnswer {
            question: question.into(),
            answer: format!(
                "{} is in {} regime (P(severe) {:.0}%, transition risk {:.0}%). \
                 Peak congestion expected Day +{} (q90 ~{:.0}). Main drivers: {}.",
                p.name,
                r.map(|x| x.current_regime.clone()).unwrap_or_else(|| "UNKNOWN".into()),
                r.map(|x| x.p_severe * 100.0).unwrap_or(0.0),
                r.map(|x| x.transition_risk * 100.0).unwrap_or(0.0),
                peak.as_ref().map(|h| h.day).unwrap_or(0),
                peak.as_ref().map(|h| h.congestion_q90).unwrap_or(0.0),
                top.join("; ")
            ),
            evidence: intel.drivers.iter().take(4).map(|d| d.detail.clone()).collect(),
            method: "rule-based over HSMM + TFT + expert features".into(),
        };
    }

    // 4) "What changed" questions.
    if q.contains("changed") || q.contains("yesterday") || q.contains("new today") {
        let mut changes = Vec::new();
        for p in &store.ports {
            if let Some(r) = regime_service::current_state(store, &p.port_id) {
                if r.days_in_state <= 2.0 {
                    changes.push(format!("{} entered {} {} day(s) ago",
                                         p.port_id, r.current_regime,
                                         r.days_in_state as i64));
                }
            }
        }
        let ans = if changes.is_empty() {
            "No regime transitions in the last 2 days; states are stable.".to_string()
        } else {
            format!("Recent regime transitions: {}.", changes.join("; "))
        };
        return AskAnswer {
            question: question.into(),
            answer: ans,
            evidence: changes,
            method: "rule-based over HSMM state history".into(),
        };
    }

    // 5) Fallback: national picture.
    let pins = port_service::map_pins(store);
    let mut top: Vec<&PortMapPin> = pins.iter().collect();
    top.sort_by(|a, b| b.congestion_now.total_cmp(&a.congestion_now));
    let names: Vec<String> = top.iter().take(3)
        .map(|p| format!("{} ({:.0})", p.port.port_id, p.congestion_now)).collect();
    AskAnswer {
        question: question.into(),
        answer: format!(
            "Across {} tracked ports, the highest congestion pressure right now: {}. \
             Ask about a specific port, vessel, or scenario for a deeper answer.",
            pins.len(), names.join(", ")),
        evidence: names,
        method: "rule-based over national snapshot".into(),
    }
}
