/* Reusable command-center components (pure HTML-string builders). */

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const fmt = {
  n0: (x) => (x == null || isNaN(x) ? "—" : Math.round(x).toLocaleString("en-IN")),
  n1: (x) => (x == null || isNaN(x) ? "—" : Number(x).toFixed(1)),
  pct: (x) => (x == null || isNaN(x) ? "—" : `${(x * 100).toFixed(0)}%`),
};

function MetricCard({ label, value, tone = "", delta = "" }) {
  return `<div class="panel metric-card">
    <div class="value ${tone}">${value}</div>
    <div class="label">${esc(label)}</div>
    ${delta ? `<div class="delta muted">${esc(delta)}</div>` : ""}
  </div>`;
}

function RiskBadge(level) {
  const l = String(level || "low").toLowerCase();
  return `<span class="badge ${esc(l)}">${esc(String(level || "LOW").toUpperCase())}</span>`;
}

function RegimeBadge(regime) {
  const r = String(regime || "NORMAL").toUpperCase();
  return `<span class="badge ${r.toLowerCase()}">${r}</span>`;
}

/* 10-day risk-tile timeline */
function RiskTileTimeline(horizon) {
  if (!horizon || !horizon.length) return `<div class="muted">No forecast.</div>`;
  const peakDay = horizon.reduce((a, b) =>
    (b.congestion_q50 > a.congestion_q50 ? b : a)).day;
  return `<div class="risk-tiles">${horizon.map((h) => `
    <div class="risk-tile ${esc(h.risk)} ${h.day === peakDay ? "peak" : ""}"
         title="q50 ${fmt.n1(h.congestion_q50)} - q90 ${fmt.n1(h.congestion_q90)} - conf ${esc(h.confidence)}">
      <div class="d">DAY +${h.day}</div>
      <div class="lvl">${esc(h.risk)}</div>
      <div class="dl">${fmt.n1(h.delay_hours)}h</div>
      <div class="q">q50 ${fmt.n0(h.congestion_q50)} / q90 ${fmt.n0(h.congestion_q90)}</div>
    </div>`).join("")}</div>`;
}

/* Quantile fan chart (kept for "view details"). */
function ForecastTimeline(horizon, { height = 190, title = "" } = {}) {
  if (!horizon || !horizon.length) return `<div class="muted">No forecast.</div>`;
  const W = 640, H = height, padL = 36, padB = 22, padT = 12, padR = 10;
  const xs = horizon.map((h) => h.day);
  const lo = Math.min(...horizon.map((h) => h.congestion_q10), 0);
  const hi = Math.max(...horizon.map((h) => h.congestion_q90), 10) * 1.08;
  const X = (d) => padL + ((d - xs[0]) / Math.max(xs[xs.length - 1] - xs[0], 1)) * (W - padL - padR);
  const Y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const line = (key) =>
    horizon.map((h, i) => `${i ? "L" : "M"}${X(h.day).toFixed(1)},${Y(h[key]).toFixed(1)}`).join(" ");
  const band =
    horizon.map((h, i) => `${i ? "L" : "M"}${X(h.day).toFixed(1)},${Y(h.congestion_q90).toFixed(1)}`).join(" ") +
    " " + [...horizon].reverse().map((h) => `L${X(h.day).toFixed(1)},${Y(h.congestion_q10).toFixed(1)}`).join(" ") + " Z";
  const gridY = [0, 25, 50, 75, 100].filter((v) => v >= lo && v <= hi);
  return `<div class="chart">${title ? `<h3>${esc(title)}</h3>` : ""}
  <svg viewBox="0 0 ${W} ${H}">
    ${gridY.map((v) => `<line x1="${padL}" x2="${W - padR}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-dasharray="3 4"/>
      <text class="axis-label" x="4" y="${Y(v) + 3}">${v}</text>`).join("")}
    <path d="${band}" fill="rgba(56,189,248,.14)"/>
    <path d="${line("congestion_q50")}" fill="none" stroke="var(--mint)" stroke-width="2.2"/>
    ${horizon.map((h) => `<text class="axis-label" x="${X(h.day) - 8}" y="${H - 6}">+${h.day}</text>`).join("")}
  </svg></div>`;
}

/* regime probability bars */
function RegimeProbPanel(cur) {
  if (!cur) return `<div class="muted">No regime state.</div>`;
  const row = (cls, label, p) => `<div class="prob-row ${cls}">
    <span>${label}</span>
    <div class="prob-bar"><div style="width:${(p * 100).toFixed(0)}%"></div></div>
    <span class="num">${(p * 100).toFixed(0)}%</span></div>`;
  return `
    ${row("normal", "Normal", cur.p_normal)}
    ${row("congested", "Congested", cur.p_congested)}
    ${row("severe", "Severe", cur.p_severe)}
    <div class="kv mt"><span class="k">Days in state</span><span class="v">${fmt.n1(cur.days_in_state)}</span></div>
    <div class="kv"><span class="k">Expected remaining duration</span><span class="v">${fmt.n1(cur.expected_remaining_days)} days</span></div>
    <div class="kv"><span class="k">Transition risk</span><span class="v">${(cur.transition_risk * 100).toFixed(1)}%</span></div>
    <div class="kv"><span class="k">State confidence</span><span class="v">${RiskBadge(cur.confidence)}</span></div>`;
}

function RegimeTimelineStrip(history) {
  if (!history || !history.length) return `<div class="muted">No regime history.</div>`;
  return `<div class="regime-strip">${history
    .map((d) => `<div class="cell ${esc(d.regime)}" title="${esc(d.date)} — ${esc(d.regime)}"></div>`)
    .join("")}</div>
    <div class="spark-note">${esc(history[0].date)} → ${esc(history[history.length - 1].date)}</div>`;
}

/* driver cards */
function DriverCards(drivers) {
  if (!drivers || !drivers.length) return `<div class="muted">No driver data.</div>`;
  return drivers.map((d, i) => {
    const heat = d.value >= 0.65 ? "hot" : d.value >= 0.45 ? "warm" : "";
    const arrow = d.trend === "rising" ? "▲" : d.trend === "falling" ? "▼" : "—";
    return `<div class="driver-card ${heat}">
      <div class="t"><span>${i + 1}. ${esc(d.name)}</span>
        <span class="arrow ${esc(d.trend)}">${arrow} ${(d.value * 100).toFixed(0)}%</span></div>
      <div class="d">${esc(d.detail)}</div>
    </div>`;
  }).join("");
}

/* expert output cards */
function ExpertCards(experts) {
  if (!experts || !experts.length) return `<div class="muted">No expert outputs.</div>`;
  return experts.map((e) => `<div class="expert-card">
    <div>
      <div class="name">${esc(e.expert)}</div>
      <div class="sig">${esc(e.signal)}</div>
      <div class="d muted small">${esc(e.detail)}</div>
    </div>
    <div class="conf">conf<br/><b>${Number(e.confidence).toFixed(2)}</b></div>
  </div>`).join("");
}

/* AI briefing card */
function AiBriefing(text, action = "") {
  return `<div class="ai-brief">
    <div class="who">◈ PORTWATCH AI · OPERATIONAL BRIEFING</div>
    <div>${esc(text)}</div>
    ${action ? `<div class="act">▸ ${esc(action)}</div>` : ""}
  </div>`;
}

/* national stress gauge */
function StressGauge(value, label = "NATIONAL LOGISTICS STRESS") {
  const v = Math.max(0, Math.min(100, value || 0));
  const R = 34, C = Math.PI * R;
  const color = v >= 60 ? "var(--red)" : v >= 45 ? "var(--amber)" : "var(--mint)";
  return `<div class="gauge-wrap">
    <svg width="96" height="58" viewBox="0 0 96 58">
      <path d="M 10 52 A ${R} ${R} 0 0 1 86 52" fill="none" stroke="var(--line)" stroke-width="9" stroke-linecap="round"/>
      <path d="M 10 52 A ${R} ${R} 0 0 1 86 52" fill="none" stroke="${color}" stroke-width="9"
        stroke-linecap="round" stroke-dasharray="${(C * v / 100).toFixed(1)} ${C.toFixed(1)}"/>
    </svg>
    <div><div class="gauge-num" style="color:${color}">${v.toFixed(0)}</div>
      <div class="gauge-label">${esc(label)}</div></div>
  </div>`;
}

function PipelineStepper(stages) {
  const nodes = stages.map((s, i) => `${i ? '<div class="step"><div class="link"></div></div>' : ""}
    <div class="step"><div class="node ${esc(s.status)}">
      <div class="name">${esc(s.stage)}</div>
      <div class="meta">${fmt.n0(s.records)} rec · ${esc(s.status).toUpperCase()}</div>
    </div></div>`).join("");
  return `<div class="stepper">${nodes}</div>`;
}

function MiniPipeline() {
  return `<div class="mini-flow">
    Weather Expert → News Expert → Port Ops Expert → Demand Expert<br/>
    &nbsp;&nbsp;↓ <b>HSMM Regime Model</b> → <b>TFT 10-Day Forecast</b> → Decision Layer
  </div>`;
}

function AlertsFeed(alerts) {
  if (!alerts || !alerts.length) return `<div class="muted">No active alerts.</div>`;
  return alerts.map((a) => `<div class="alert-row">
      ${RiskBadge(a.level === "severe" ? "SEVERE" : a.level === "warning" ? "MEDIUM" : "INFO")}
      <div><a href="/ports/${esc(a.port_id)}" data-link>${esc(a.port_id)}</a>
        <span class="muted"> — ${esc(a.message)}</span></div>
    </div>`).join("");
}

function KV(k, v) {
  return `<div class="kv"><span class="k">${esc(k)}</span><span class="v">${v}</span></div>`;
}
