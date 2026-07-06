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

/* 10-day quantile fan chart (q10–q90 band + q50 line), pure SVG. */
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
    " " +
    [...horizon].reverse().map((h) => `L${X(h.day).toFixed(1)},${Y(h.congestion_q10).toFixed(1)}`).join(" ") +
    " Z";

  const gridY = [0, 25, 50, 75, 100].filter((v) => v >= lo && v <= hi);
  const dots = horizon
    .map((h) => {
      const c = h.risk === "HIGH" || h.risk === "CRITICAL" ? "var(--red)"
        : h.risk === "MEDIUM" ? "var(--amber)" : "var(--green)";
      return `<circle cx="${X(h.day).toFixed(1)}" cy="${Y(h.congestion_q50).toFixed(1)}" r="3.2" fill="${c}"/>`;
    })
    .join("");

  return `<div class="chart">${title ? `<h3>${esc(title)}</h3>` : ""}
  <svg viewBox="0 0 ${W} ${H}">
    ${gridY.map((v) => `<line x1="${padL}" x2="${W - padR}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-dasharray="3 4"/>
      <text class="axis-label" x="4" y="${Y(v) + 3}">${v}</text>`).join("")}
    <path d="${band}" fill="rgba(56,189,248,.14)" stroke="none"/>
    <path d="${line("congestion_q90")}" fill="none" stroke="rgba(56,189,248,.5)" stroke-width="1" stroke-dasharray="4 4"/>
    <path d="${line("congestion_q10")}" fill="none" stroke="rgba(56,189,248,.35)" stroke-width="1" stroke-dasharray="4 4"/>
    <path d="${line("congestion_q50")}" fill="none" stroke="var(--mint)" stroke-width="2.2"/>
    ${dots}
    ${horizon.map((h) => `<text class="axis-label" x="${X(h.day) - 8}" y="${H - 6}">+${h.day}</text>`).join("")}
  </svg>
  <div class="spark-note">q10–q90 uncertainty band · dots coloured by risk level</div></div>`;
}

/* Simple bar chart for delay / throughput per horizon day. */
function BarTimeline(horizon, key, { height = 130, color = "var(--cyan)", label = "" } = {}) {
  if (!horizon || !horizon.length) return "";
  const W = 640, H = height, padL = 42, padB = 20, padT = 8;
  const vals = horizon.map((h) => h[key] ?? 0);
  const hi = Math.max(...vals, 1) * 1.15;
  const bw = (W - padL - 10) / horizon.length;
  const bars = horizon
    .map((h, i) => {
      const v = h[key] ?? 0;
      const bh = (v / hi) * (H - padT - padB);
      return `<rect x="${(padL + i * bw + 3).toFixed(1)}" y="${(H - padB - bh).toFixed(1)}"
        width="${(bw - 6).toFixed(1)}" height="${bh.toFixed(1)}" rx="2" fill="${color}" opacity=".75"/>`;
    })
    .join("");
  return `<div class="chart">${label ? `<h3>${esc(label)}</h3>` : ""}
  <svg viewBox="0 0 ${W} ${H}">
    ${bars}
    <text class="axis-label" x="4" y="${padT + 8}">${fmt.n0(hi)}</text>
    ${horizon.map((h, i) => `<text class="axis-label" x="${(padL + i * bw + bw / 2 - 8).toFixed(1)}" y="${H - 5}">+${h.day}</text>`).join("")}
  </svg></div>`;
}

/* HSMM regime history strip (one cell per day). */
function RegimeTimelineStrip(history) {
  if (!history || !history.length) return `<div class="muted">No regime history.</div>`;
  const cells = history
    .map((d) => `<div class="cell ${esc(d.regime)}" title="${esc(d.date)} — ${esc(d.regime)}"></div>`)
    .join("");
  return `<div class="regime-strip">${cells}</div>
    <div class="spark-note">${esc(history[0].date)} → ${esc(history[history.length - 1].date)} · green normal · amber congested · red severe</div>`;
}

function DriverPanel(drivers) {
  if (!drivers || !drivers.length) return `<div class="muted">No driver data.</div>`;
  return drivers
    .map((d) => {
      const v = Math.max(0, Math.min(1, d.value ?? 0));
      return `<div class="driver-row">
        <span>${esc(d.name)}</span>
        <div class="driver-bar"><div style="width:${(v * 100).toFixed(0)}%"></div></div>
        <span class="num">${(v * 100).toFixed(0)}%</span>
      </div>`;
    })
    .join("");
}

function PipelineStepper(stages) {
  const nodes = stages
    .map(
      (s, i) => `${i ? '<div class="step"><div class="link"></div></div>' : ""}
    <div class="step"><div class="node ${esc(s.status)}">
      <div class="name">${esc(s.stage)}</div>
      <div class="meta">${fmt.n0(s.records)} rec · ${esc(s.status).toUpperCase()}</div>
    </div></div>`
    )
    .join("");
  return `<div class="stepper">${nodes}</div>`;
}

function AlertsFeed(alerts) {
  if (!alerts || !alerts.length) return `<div class="muted">No active alerts.</div>`;
  return alerts
    .map(
      (a) => `<div class="alert-row">
      ${RiskBadge(a.level === "severe" ? "SEVERE" : a.level === "warning" ? "MEDIUM" : "INFO")}
      <div><a href="/ports/${esc(a.port_id)}" data-link>${esc(a.port_id)}</a>
        <span class="muted"> — ${esc(a.message)}</span></div>
    </div>`
    )
    .join("");
}

function KV(k, v) {
  return `<div class="kv"><span class="k">${esc(k)}</span><span class="v">${v}</span></div>`;
}
