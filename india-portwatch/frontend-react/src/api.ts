/* Typed client for the Rust backend. */
export interface Envelope<T> { data_mode: "real" | "partial" | "mock"; warning?: string; data: T; }
export interface Port {
  port_id: string; name: string; region: string; lat: number; lon: number;
  port_capacity: number; berth_count: number; connectivity_score: number;
}
export interface Pin extends Port {
  regime: "NORMAL" | "CONGESTED" | "SEVERE" | "UNKNOWN";
  regime_confidence: string; congestion_now: number; delay_hours: number;
  throughput: number; risk_level: string; transition_risk: number;
}
export interface ForecastPoint {
  day: number; target_date: string; congestion_q10: number; congestion_q50: number;
  congestion_q90: number; delay_hours: number; throughput: number;
  risk: string; confidence: string;
}
export interface PortForecast { port_id: string; origin_date: string; model: string; horizon: ForecastPoint[]; }
export interface RegimeState {
  port_id: string; current_regime: string; p_normal: number; p_congested: number;
  p_severe: number; days_in_state: number; expected_remaining_days: number;
  transition_risk: number; confidence: string;
}
export interface RegimeTimeline { port_id: string; current: RegimeState; history: { date: string; regime: string; p_severe: number }[]; }
export interface Briefing {
  port_id: string; port_name: string; current_regime: string; days_in_state: number;
  expected_remaining_days: number; transition_risk: number; peak_congestion_day: number;
  peak_congestion_q50: number; peak_congestion_q90: number; peak_delay_hours: number;
  mean_throughput: number; weather_impact: string; capacity_risk: string;
  high_risk_days: number[]; recommended_action: string; summary: string;
}
export interface Driver { name: string; value: number; trend: string; detail: string; }
export interface ExpertOutput {
  expert: string; input_signal: string; signal: string; value: number;
  confidence: number; effect: string; last_run: string; detail: string;
}
export interface WxReport {
  port_id: string; mode: string; as_of: string; wind_kt: number; wind_dir: string;
  rainfall_mm: number; wave_m: number; visibility_km: number; cyclone_risk: string;
  weather_persistence: number; weather_shock: number; weather_impact_score: number;
  weather_confidence: number; weather_hsmm_input: number; weather_tft_covariate: number;
}
export interface SarReport {
  port_id: string; mode: string; scene_time: string; vessel_detections: number;
  anchorage_density: number; queue_zone_activity: number; change_vs_prev_pct: number;
  sar_confidence: number; note: string;
}
export interface PortIntel { port_id: string; drivers: Driver[]; expert_outputs: ExpertOutput[]; }
export interface Vessel { id: string; name: string; lat: number; lon: number; heading: number; speed_kn: number; status: string; }
export interface PortLive {
  port_id: string; ais_mode: string; ais_confidence: number; generated_at: string;
  anchorage: { lat: number; lon: number; radius_km: number };
  queue_count: number; berth_utilization: number; weather_badge: string; vessels: Vessel[];
}
export interface Ship {
  ship_id: string; name: string; intended_port: string; recommended_port: string;
  reroute: boolean; eta_window: string; berth_waiting_risk: string; port_entry_risk: string;
  best_arrival_day: number; worst_arrival_day: number; recommended_buffer_hours: string;
  confidence: string;
}
export interface ShipRec extends Ship { advisory: string; reason: string; }
export interface ScenarioPreset { id: string; name: string; description: string; category: string; }
export interface PortImpact {
  port_id: string; port_name: string; lat: number; lon: number;
  baseline_congestion: number; scenario_congestion: number; congestion_delta: number;
  baseline_delay_hours: number; scenario_delay_hours: number; delay_delta_hours: number;
  throughput_change_pct: number; risk_before: string; risk_after: string;
}
export interface ScenarioResult {
  scenario_id: string; scenario_name: string; intensity: number;
  affected_ports: PortImpact[]; national_summary: string; recommended_response: string[];
}
export interface StageStatus {
  stage: string; status: string; latest_run?: string; files_found: string[];
  files_missing: string[]; records: number; warnings: string[];
}
export interface ModelStatus { pipeline: StageStatus[]; data_mode: string; outputs_dir: string; walk_forward?: Record<string, unknown>; }
export interface NewsEvent {
  date: string; headline: string; source: string; url: string; entity: string;
  event_type: string; sentiment: number; risk_score: number; confidence: number;
  affected_ports: string[]; model_impact: string;
}
export interface AskAnswer { question: string; answer: string; evidence: string[]; method: string; }
export interface Alert { level: string; port_id: string; message: string; }

async function get<T>(path: string): Promise<T> {
  const r = await fetch(path, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`${path} → HTTP ${r.status}`);
  return r.json();
}
async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} → HTTP ${r.status}`);
  return r.json();
}

export const api = {
  ports: () => get<Envelope<Port[]>>("/api/ports"),
  pins: () => get<Envelope<Pin[]>>("/api/ports/map"),
  pin: (id: string) => get<Envelope<Pin>>(`/api/ports/${id}`),
  live: (id: string) => get<Envelope<PortLive>>(`/api/ports/${id}/live`),
  wx: (id: string) => get<Envelope<WxReport>>(`/api/ports/${id}/wx`),
  sar: (id: string) => get<Envelope<SarReport>>(`/api/ports/${id}/sar`),
  liveNational: () => get<Envelope<PortLive[]>>("/api/live"),
  forecast: (id: string) => get<Envelope<PortForecast>>(`/api/ports/${id}/forecast`),
  regime: (id: string) => get<Envelope<RegimeTimeline>>(`/api/ports/${id}/regime`),
  briefing: (id: string) => get<Envelope<Briefing>>(`/api/ports/${id}/briefing`),
  drivers: (id: string) => get<Envelope<PortIntel>>(`/api/ports/${id}/drivers`),
  newsPort: (id: string) => get<Envelope<NewsEvent[]>>(`/api/ports/${id}/news`),
  news: () => get<Envelope<NewsEvent[]>>("/api/news"),
  ships: () => get<Envelope<Ship[]>>("/api/ships"),
  shipRec: (id: string) => get<Envelope<ShipRec>>(`/api/ships/${id}/recommendation`),
  scenarios: () => get<Envelope<ScenarioPreset[]>>("/api/scenarios"),
  simulate: (scenario_id: string, intensity: number) =>
    post<Envelope<ScenarioResult>>("/api/scenarios/simulate", { scenario_id, intensity }),
  alerts: () => get<{ data_mode: string; data: Alert[] }>("/api/alerts"),
  modelStatus: () => get<ModelStatus>("/api/model/status"),
  ask: (question: string) => post<AskAnswer>("/api/ask", { question }),
};

export const fmt = {
  n0: (x?: number | null) => (x == null || isNaN(x) ? "—" : Math.round(x).toLocaleString("en-IN")),
  n1: (x?: number | null) => (x == null || isNaN(x) ? "—" : Number(x).toFixed(1)),
  pct: (x?: number | null) => (x == null || isNaN(x) ? "—" : `${(x * 100).toFixed(0)}%`),
};
