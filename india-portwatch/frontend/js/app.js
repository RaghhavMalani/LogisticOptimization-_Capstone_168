/* Router + pages for the India PortWatch AI command center. */

const view = () => document.getElementById("view");

/* Page-scoped timers: cleared on every navigation so maps/tickers don't leak. */
let pageTimers = [];
function addTimer(fn, ms) { pageTimers.push(setInterval(fn, ms)); }
function clearTimers() { pageTimers.forEach(clearInterval); pageTimers = []; }

/* router */
function navigate(path) {
  history.pushState({}, "", path);
  render();
}
document.addEventListener("click", (e) => {
  const a = e.target.closest("a[data-link]");
  if (!a) return;
  e.preventDefault();
  navigate(a.getAttribute("href"));
});
window.addEventListener("popstate", render);

function setActiveNav(route) {
  document.querySelectorAll(".nav-item").forEach((el) =>
    el.classList.toggle("active", el.dataset.route === route));
}

async function render() {
  clearTimers();
  const path = location.pathname;
  try {
    if (path === "/" || path === "") return await pageRadar();
    let m;
    if ((m = path.match(/^\/ports\/([^/]+)$/))) return await pageCockpit(m[1].toUpperCase());
    if (path === "/decision" || path === "/scenarios") return await pageDecision();
    if (path === "/ships") return await pageShips();
    if (path === "/analytics") return await pageAnalytics();
    if (path === "/model") return await pageModel();
    return await pageRadar();
  } catch (err) {
    view().innerHTML = `<div class="panel"><h3>ERROR</h3>
      <div class="mono" style="color:var(--red)">${esc(err.message)}</div>
      <div class="muted mt">Is the backend running? <span class="mono">cargo run -p portwatch-backend</span></div></div>`;
  }
}

/* Capacity-weighted national stress index (0-100). */
function stressIndex(pins) {
  let num = 0, den = 0;
  for (const p of pins) {
    const w = p.port_capacity || 0.5;
    num += w * (p.congestion_now || 0);
    den += w;
  }
  return den ? num / den : 0;
}

/* 1. National Port Radar */
async function pageRadar() {
  setActiveNav("radar");
  const [pinsEnv, alertsEnv, liveEnv] = await Promise.all([
    API.mapPins(), API.alerts(), API.liveNational().catch(() => null),
  ]);
  setDataMode(pinsEnv.data_mode);
  const pins = pinsEnv.data;
  const stress = stressIndex(pins);
  const severe = pins.filter((p) => p.regime === "SEVERE");
  const congested = pins.filter((p) => p.regime === "CONGESTED");
  const top = [...pins].sort((a, b) => b.congestion_now - a.congestion_now).slice(0, 5);
  const vessels = (liveEnv?.data || []).flatMap((l) => l.vessels);

  view().innerHTML = `
    <div class="page-head">
      <div><div class="page-title">NATIONAL PORT RADAR</div>
        <h1><span class="pulse-dot"></span>India Maritime Operations</h1>
        <div class="sub">${pins.length} ports · ${vessels.length} tracked vessels
          <span class="badge info">AIS/SATELLITE PROXY MODE</span></div></div>
      <div class="panel" style="padding:10px 16px">${StressGauge(stress)}</div>
    </div>

    <div class="grid" style="grid-template-columns: 2.3fr 1fr;">
      <div>
        <div id="map-wrap"><div id="map"></div>${MapLegend()}</div>
        <div class="grid cols-4 mt">
          ${MetricCard({ label: "SEVERE PORTS", value: severe.length,
            tone: severe.length ? "red" : "", delta: severe.map((p) => p.port_id).join(" · ") || "none" })}
          ${MetricCard({ label: "CONGESTED PORTS", value: congested.length,
            tone: congested.length ? "amber" : "" })}
          ${MetricCard({ label: "MEAN CONGESTION", value: fmt.n1(stress),
            tone: stress >= 60 ? "red" : stress >= 45 ? "amber" : "" })}
          ${MetricCard({ label: "VESSELS IN FIELD", value: vessels.length, delta: "proxy signal" })}
        </div>
      </div>
      <div class="grid" style="align-content:start">
        <div class="panel"><h3>Top 5 ports at risk</h3>
          ${top.map((p, i) => `<div class="kv">
            <span class="k"><span class="rank-num">${i + 1}.</span>
              <a href="/ports/${esc(p.port_id)}" data-link>${esc(p.name)}</a></span>
            <span class="v">${fmt.n1(p.congestion_now)} ${RegimeBadge(p.regime)}</span></div>`).join("")}
        </div>
        <div class="panel"><h3><span class="pulse-dot"></span>Active alerts</h3>
          <div id="alert-feed" style="max-height:300px;overflow-y:auto">${AlertsFeed(alertsEnv.data)}</div>
        </div>
        <div class="panel"><h3>Model pipeline</h3>${MiniPipeline()}</div>
      </div>
    </div>`;

  const map = renderPortMap(document.getElementById("map"), pins);
  if (map && vessels.length) {
    let tick = () => {};
    (map.loaded && map.loaded() ? Promise.resolve() : new Promise((r) => map.on("load", r)))
      .then(() => { tick = addVesselLayer(map, vessels); });
    addTimer(() => tick(), 1100);
  }
  addTimer(async () => {
    try {
      const a = await API.alerts();
      const el = document.getElementById("alert-feed");
      if (el) { el.innerHTML = AlertsFeed(a.data); el.firstElementChild?.classList.add("fresh"); }
    } catch (_) {}
  }, 20000);
}

/* 2. Port Operations Cockpit */
async function pageCockpit(portId) {
  setActiveNav("cockpit");
  view().innerHTML = `<div class="loading">LOADING ${esc(portId)} COCKPIT…</div>`;

  const [ports, pinEnv, fcEnv, regEnv, briefEnv, intelEnv, liveEnv] = await Promise.all([
    API.ports(),
    API.port(portId),
    API.forecast(portId).catch(() => null),
    API.regime(portId).catch(() => null),
    API.briefing(portId).catch(() => null),
    API.drivers(portId).catch(() => null),
    API.portLive(portId).catch(() => null),
  ]);
  setDataMode(pinEnv.data_mode);
  const pin = pinEnv.data;
  const fc = fcEnv?.data;
  const cur = regEnv?.data?.current;
  const brief = briefEnv?.data;
  const intel = intelEnv?.data;
  const live = liveEnv?.data;

  const selector = `<select id="port-select">${ports.data
    .map((p) => `<option value="${esc(p.port_id)}" ${p.port_id === pin.port_id ? "selected" : ""}>${esc(p.name)}</option>`)
    .join("")}</select>`;

  view().innerHTML = `
    <div class="page-head">
      <div><div class="page-title">PORT OPERATIONS COCKPIT — ${esc(pin.region).toUpperCase()} COAST</div>
        <h1>${esc(pin.name)} ${RegimeBadge(pin.regime)}</h1>
        <div class="sub">${fc ? `forecast origin ${esc(fc.origin_date)} · model ${esc(fc.model)} · ` : ""}
          state confidence ${esc(pin.regime_confidence)}</div></div>
      <div>${selector}</div>
    </div>

    <div class="grid cols-4">
      ${MetricCard({ label: "CONGESTION (DAY +1)", value: fmt.n1(pin.congestion_now),
        tone: pin.congestion_now >= 60 ? "red" : pin.congestion_now >= 45 ? "amber" : "" })}
      ${MetricCard({ label: "DELAY FORECAST (H)", value: fmt.n1(pin.delay_hours),
        tone: pin.delay_hours >= 18 ? "red" : pin.delay_hours >= 10 ? "amber" : "" })}
      ${MetricCard({ label: "THROUGHPUT (T/DAY)", value: fmt.n0(pin.throughput) })}
      ${MetricCard({ label: "TRANSITION RISK", value: fmt.pct(pin.transition_risk),
        tone: pin.transition_risk >= 0.3 ? "amber" : "" })}
    </div>

    ${brief ? `<div class="mt">${AiBriefing(brief.summary.split("Recommended action:")[0].trim(),
      brief.recommended_action)}</div>` : ""}

    <div class="grid mt" style="grid-template-columns: 1.4fr 1fr;">
      <div class="panel">
        <h3>Port area — live vessel field</h3>
        <div class="area-wrap">
          <div id="port-area-map"></div>
          <div class="area-overlay">
            <span class="chip mock">AIS/SATELLITE PROXY MODE</span>
            ${live ? `<span class="chip">QUEUE ${live.queue_count}</span>
            <span class="chip">WX ${esc(live.weather_badge)}</span>
            <span class="chip">AIS CONF ${Number(live.ais_confidence).toFixed(2)}</span>` : ""}
          </div>
          ${live ? `<div class="berth-bar">BERTH / CAPACITY UTILISATION
            <b class="mono">${(live.berth_utilization * 100).toFixed(0)}%</b>
            <div class="track"><div style="width:${(live.berth_utilization * 100).toFixed(0)}%"></div></div>
          </div>` : ""}
        </div>
        <div class="spark-note">amber ring = anchorage zone · squares = anchored/berthed · dots = moving (simulated proxy)</div>
      </div>
      <div class="panel">
        <h3>HSMM regime — model explanation</h3>
        ${RegimeProbPanel(cur)}
        <details class="more"><summary>REGIME HISTORY (45 DAYS)</summary>
          ${RegimeTimelineStrip(regEnv?.data?.history)}</details>
      </div>
    </div>

    <div class="panel mt">
      <h3>10-day forecast timeline</h3>
      ${RiskTileTimeline(fc?.horizon)}
      <details class="more"><summary>QUANTILE DETAIL (q10-q90 FAN)</summary>
        ${ForecastTimeline(fc?.horizon)}</details>
    </div>

    <div class="grid cols-2 mt">
      <div class="panel">
        <h3>Why — top forecast drivers</h3>
        ${DriverCards(intel?.drivers)}
      </div>
      <div class="panel">
        <h3>Model outputs — expert modules</h3>
        ${ExpertCards(intel?.expert_outputs)}
        ${fc ? `<div class="expert-card"><div>
            <div class="name">TFT Forecast</div>
            <div class="sig">Peak congestion Day +${brief?.peak_congestion_day ?? "—"} · q90 ${fmt.n0(brief?.peak_congestion_q90)}</div>
            <div class="d muted small">Multi-horizon quantile forecast over expert + regime features.</div>
          </div><div class="conf">model<br/><b>${esc(fc.model)}</b></div></div>` : ""}
      </div>
    </div>`;

  if (live) {
    const tick = renderPortAreaMap(document.getElementById("port-area-map"), pin, live);
    addTimer(() => tick(), 1100);
  }
  document.getElementById("port-select").addEventListener("change", (e) =>
    navigate(`/ports/${e.target.value}`));
}

/* 3. AI Decision Room */
async function pageDecision() {
  setActiveNav("decision");
  const [env, pinsEnv] = await Promise.all([API.scenarios(), API.mapPins()]);
  const presets = env.data;
  const pins = pinsEnv.data;
  const worstPin = [...pins].sort((a, b) => b.congestion_now - a.congestion_now)[0];
  const briefEnv = worstPin ? await API.briefing(worstPin.port_id).catch(() => null) : null;
  let selected = presets[0]?.id;

  view().innerHTML = `
    <div class="page-head">
      <div><div class="page-title">AI DECISION ROOM</div>
        <h1>What-if · Why · What to do</h1>
        <div class="sub">Shocks are applied to the live forecast — deltas relative to today's model view</div></div>
    </div>

    ${briefEnv ? AiBriefing(
      `Current national focus: ${briefEnv.data.port_name}. ${briefEnv.data.summary.split("Recommended action:")[0].trim()}`,
      briefEnv.data.recommended_action) : ""}

    <div class="grid mt" style="grid-template-columns: 1fr 2fr">
      <div>
        <div class="grid" id="preset-list">
          ${presets.map((p) => `<div class="panel scenario-card ${p.id === selected ? "selected" : ""}" data-id="${esc(p.id)}">
            <div class="cat">${esc(p.category)}</div><h4>${esc(p.name)}</h4>
            <p>${esc(p.description)}</p></div>`).join("")}
        </div>
        <div class="panel mt">
          <h3>Intensity <span class="mono" id="int-val">1.0×</span></h3>
          <input type="range" id="intensity" min="0.5" max="2" step="0.1" value="1" />
          <button class="btn mt" id="run-sim" style="width:100%">RUN SIMULATION</button>
        </div>
      </div>
      <div id="sim-result"><div class="panel"><h3>Impact</h3>
        <div class="muted">Choose a scenario and run the simulation.</div></div></div>
    </div>`;

  const list = document.getElementById("preset-list");
  list.addEventListener("click", (e) => {
    const card = e.target.closest(".scenario-card");
    if (!card) return;
    selected = card.dataset.id;
    list.querySelectorAll(".scenario-card").forEach((c) =>
      c.classList.toggle("selected", c.dataset.id === selected));
  });
  const slider = document.getElementById("intensity");
  slider.addEventListener("input", () =>
    (document.getElementById("int-val").textContent = `${Number(slider.value).toFixed(1)}×`));

  document.getElementById("run-sim").addEventListener("click", async () => {
    const btn = document.getElementById("run-sim");
    btn.disabled = true; btn.textContent = "SIMULATING…";
    try {
      const res = await API.simulate(selected, Number(slider.value));
      setDataMode(res.data_mode);
      renderSimResult(res.data);
    } finally {
      btn.disabled = false; btn.textContent = "RUN SIMULATION";
    }
  });
}

function renderSimResult(r) {
  const worst = r.affected_ports.slice(0, 3);
  document.getElementById("sim-result").innerHTML = `
    <div class="grid cols-3">
      ${MetricCard({ label: "PORTS AFFECTED", value: r.affected_ports.length })}
      ${MetricCard({ label: "RISK ESCALATIONS",
        value: r.affected_ports.filter((p) => p.risk_after !== p.risk_before).length, tone: "amber" })}
      ${MetricCard({ label: "WORST DELAY IMPACT",
        value: `+${fmt.n1(Math.max(...r.affected_ports.map((p) => p.delay_delta_hours), 0))}h`, tone: "red" })}
    </div>
    <div class="panel mt">
      ${AiBriefing(r.national_summary, r.recommended_response[0] || "")}
      <div class="grid cols-3 mt">
        ${worst.map((p) => `<div class="panel">
          <b>${esc(p.port_name)}</b>
          <div class="kv"><span class="k">Congestion</span>
            <span class="v">${fmt.n1(p.baseline_congestion)} → <b style="color:var(--amber)">${fmt.n1(p.scenario_congestion)}</b></span></div>
          <div class="kv"><span class="k">Delay</span>
            <span class="v">+${fmt.n1(p.delay_delta_hours)}h</span></div>
          <div class="kv"><span class="k">Throughput</span><span class="v">${fmt.n1(p.throughput_change_pct)}%</span></div>
          <div class="kv"><span class="k">Risk</span>
            <span class="v">${RiskBadge(p.risk_before)} → ${RiskBadge(p.risk_after)}</span></div>
        </div>`).join("")}
      </div>
    </div>
    <div class="panel mt"><h3>Recommended response</h3>
      ${r.recommended_response.map((s) => `<div class="kv"><span class="k">▸</span>
        <span style="text-align:left;flex:1;margin-left:10px">${esc(s)}</span></div>`).join("")}
      <details class="more"><summary>VIEW DETAILS — ALL AFFECTED PORTS</summary>
        <table class="ops"><thead><tr><th>Port</th><th>ΔCongestion</th><th>ΔDelay</th><th>ΔThroughput</th><th>Risk</th></tr></thead>
        <tbody>${r.affected_ports.map((p) => `<tr>
          <td><a href="/ports/${esc(p.port_id)}" data-link>${esc(p.port_name)}</a></td>
          <td>+${fmt.n1(p.congestion_delta)}</td><td>+${fmt.n1(p.delay_delta_hours)}h</td>
          <td>${fmt.n1(p.throughput_change_pct)}%</td>
          <td>${RiskBadge(p.risk_before)} → ${RiskBadge(p.risk_after)}</td></tr>`).join("")}
        </tbody></table></details>
    </div>`;
}

/* 4. Fleet Board */
async function pageShips() {
  setActiveNav("ships");
  const env = await API.ships();
  setDataMode(env.data_mode);
  const ships = env.data;

  view().innerHTML = `
    <div class="page-head">
      <div><div class="page-title">FLEET OPERATIONS</div><h1>Ship Manager Board</h1>
        <div class="sub">${ships.length} vessels tracked · click a vessel for the full advisory</div></div>
    </div>
    <div class="grid" style="grid-template-columns: 1.7fr 1fr">
      <div class="panel">
        <h3>Fleet board</h3>
        <table class="ops"><thead><tr>
          <th>Vessel</th><th>Route</th><th>ETA window</th><th>Berth wait</th>
          <th>Entry risk</th><th>Best / worst</th><th>Buffer</th><th>Conf.</th>
        </tr></thead><tbody>
        ${ships.map((s) => `<tr data-ship="${esc(s.ship_id)}" style="cursor:pointer">
          <td>${esc(s.name)}</td>
          <td>${esc(s.intended_port)}${s.reroute ? ` → <b style="color:var(--amber)">${esc(s.recommended_port)}</b>` : ""}</td>
          <td>${esc(s.eta_window)}</td>
          <td>${RiskBadge(s.berth_waiting_risk)}</td>
          <td>${RiskBadge(s.port_entry_risk)}</td>
          <td>+${s.best_arrival_day} / +${s.worst_arrival_day}</td>
          <td>${esc(s.recommended_buffer_hours)} h</td>
          <td>${RiskBadge(s.confidence)}</td>
        </tr>`).join("")}
        </tbody></table>
      </div>
      <div class="panel" id="ship-detail">
        <h3>Vessel advisory</h3>
        <div class="muted">Select a vessel from the board.</div>
      </div>
    </div>`;

  document.querySelectorAll("tr[data-ship]").forEach((tr) =>
    tr.addEventListener("click", async () => {
      const rec = await API.shipRec(tr.dataset.ship);
      const r = rec.data;
      document.getElementById("ship-detail").innerHTML = `
        <h3>Vessel advisory — ${esc(r.name)}</h3>
        ${r.reroute ? `<div class="ai-brief" style="margin-bottom:10px">
          <div class="who">◈ REROUTE ADVISED</div>
          ${esc(r.intended_port)} → <b>${esc(r.recommended_port)}</b><br/>
          <span class="muted small">${esc(r.reason)}</span></div>` : ""}
        ${KV("Destination", `${esc(r.intended_port)}${r.reroute ? " → " + esc(r.recommended_port) : " (keep)"}`)}
        ${KV("Best arrival", `Day +${r.best_arrival_day}`)}
        ${KV("Recommended buffer", `${esc(r.recommended_buffer_hours)} h`)}
        ${KV("Berth waiting risk", RiskBadge(r.berth_waiting_risk))}
        ${KV("Port entry risk", RiskBadge(r.port_entry_risk))}
        ${KV("Confidence", RiskBadge(r.confidence))}
        <div class="action-panel mt">${esc(r.advisory)}<br/><br/>
          <span class="muted small">Reason: ${esc(r.reason)}</span></div>`;
    }));
}

/* 5. Analytics */
async function pageAnalytics() {
  setActiveNav("analytics");
  const env = await API.analytics();
  setDataMode(env.data_mode);
  const d = env.data;
  const league = [...d.league].sort((a, b) => (a.efficiency_rank ?? 99) - (b.efficiency_rank ?? 99));

  view().innerHTML = `
    <div class="page-head">
      <div><div class="page-title">ALL-PORT COMPARISON</div><h1>Analytics</h1></div>
    </div>
    <div class="grid cols-2">
      <div class="panel"><h3>Port efficiency ranking</h3>
        <table class="ops"><thead><tr><th>#</th><th>Port</th><th>Region</th><th>Cargo (MT)</th><th>Util.</th><th>Turnaround (d)</th><th>Efficiency</th></tr></thead>
        <tbody>${league.map((r, i) => `<tr>
          <td class="rank-num">${i + 1}</td>
          <td><a href="/ports/${esc(r.port_id)}" data-link>${esc(r.port_name || r.port_id)}</a></td>
          <td>${esc(r.region || "—")}</td><td>${fmt.n1(r.cargo_mt)}</td>
          <td>${r.capacity_utilization != null ? fmt.pct(r.capacity_utilization) : "—"}</td>
          <td>${fmt.n1(r.turnaround_days)}</td>
          <td>${r.efficiency_score != null ? fmt.n1(r.efficiency_score * 100) : "—"}</td></tr>`).join("")}
        </tbody></table>
      </div>
      <div class="grid" style="align-content:start">
        <div class="panel"><h3>Demand index by port</h3>
          ${d.demand.map((r) => {
            const v = Math.min(1, (r.demand_index ?? 0) / 130);
            return `<div class="driver-row"><span>${esc(r.port_name || r.port_id)}</span>
              <div class="driver-bar"><div style="width:${(v * 100).toFixed(0)}%"></div></div>
              <span class="num">${fmt.n1(r.demand_index)}</span></div>`;
          }).join("")}
        </div>
        <div class="panel"><h3>Cargo mix (container / dry / liquid)</h3>
          ${d.cargo_split.map((r) => {
            const a = (r.containerised ?? 0) * 100, b = (r.dry_bulk ?? 0) * 100,
                  c = (r.liquid_bulk ?? 0) * 100;
            return `<div class="driver-row"><span>${esc(r.port_id)}</span>
              <div class="driver-bar" style="display:flex">
                <div style="width:${a}%;background:var(--cyan)"></div>
                <div style="width:${b}%;background:var(--amber)"></div>
                <div style="width:${c}%;background:var(--mint)"></div></div>
              <span class="num">${a.toFixed(0)}/${b.toFixed(0)}/${c.toFixed(0)}</span></div>`;
          }).join("")}
        </div>
      </div>
    </div>
    <div class="grid cols-2 mt">
      <div class="panel"><h3>Anomalies</h3>
        ${d.anomalies.length ? `<table class="ops"><thead><tr><th>Port</th><th>Date</th><th>Metric</th><th>Value</th><th>Z</th></tr></thead>
          <tbody>${d.anomalies.slice(0, 12).map((a) => `<tr>
            <td>${esc(a.port_id)}</td><td>${esc(a.date || "—")}</td><td>${esc(a.metric || "—")}</td>
            <td>${fmt.n1(a.value)}</td><td style="color:var(--amber)">${fmt.n1(a.zscore)}</td></tr>`).join("")}
          </tbody></table>` : `<div class="muted">No anomalies flagged.</div>`}
      </div>
      <div class="panel"><h3>Walk-forward backtest</h3>
        ${d.walk_forward.length ? `<table class="ops"><thead><tr><th>Fold</th><th>Train end</th><th>MAE</th><th>RMSE</th><th>MAPE%</th><th>Cov. 80% (cal)</th></tr></thead>
          <tbody>${d.walk_forward.map((w) => `<tr>
            <td>${w.fold ?? "—"}</td><td>${esc(w.train_end || "—")}</td>
            <td>${fmt.n1(w.mae)}</td><td>${fmt.n1(w.rmse)}</td><td>${fmt.n1(w.mape_pct)}</td>
            <td>${w.coverage_80pct_cal != null ? fmt.pct(w.coverage_80pct_cal) : "—"}</td></tr>`).join("")}
          </tbody></table>` : `<div class="muted">No backtest metrics found.</div>`}
      </div>
    </div>`;
}

/* 6. Model */
async function pageModel() {
  setActiveNav("model");
  const st = await API.modelStatus();
  setDataMode(st.data_mode);

  view().innerHTML = `
    <div class="page-head">
      <div><div class="page-title">PIPELINE HEALTH</div><h1>Model Status</h1>
        <div class="sub mono">outputs: ${esc(st.outputs_dir)}</div></div>
    </div>
    <div class="panel">${PipelineStepper(st.pipeline)}</div>
    <div class="grid cols-3 mt">
      ${st.pipeline.map((s) => `<div class="panel">
        <h3>${esc(s.stage)}</h3>
        ${KV("Status", `<span class="badge ${s.status === "ok" ? "low" : s.status === "degraded" ? "medium" : "high"}">${esc(s.status.toUpperCase())}</span>`)}
        ${KV("Latest run", esc(s.latest_run || "—"))}
        ${KV("Records", fmt.n0(s.records))}
        ${s.files_found.length ? KV("Files found", `<span class="small">${s.files_found.map(esc).join("<br/>")}</span>`) : ""}
        ${s.files_missing.length ? KV("Missing", `<span class="small" style="color:var(--amber)">${s.files_missing.map(esc).join("<br/>")}</span>`) : ""}
        ${s.warnings.length ? KV("Warnings", `<span style="color:var(--amber)">${s.warnings.map(esc).join("; ")}</span>`) : ""}
      </div>`).join("")}
    </div>
    ${st.walk_forward ? `<div class="panel mt"><h3>Walk-forward summary</h3>
      ${Object.entries(st.walk_forward).map(([k, v]) => KV(k, esc(String(v)))).join("")}
    </div>` : ""}`;
}

/* global tickers */
setInterval(() => {
  const el = document.getElementById("utc-clock");
  if (el) el.textContent = new Date().toISOString().slice(0, 19).replace("T", " ") + "Z";
}, 1000);

async function refreshModelFreshness() {
  try {
    const st = await API.modelStatus();
    const tft = st.pipeline.find((s) => s.stage === "TFT FORECAST");
    const el = document.getElementById("model-fresh");
    if (el) el.textContent = `MODEL ${tft?.latest_run || "—"}`;
  } catch (_) {}
}
refreshModelFreshness();
setInterval(refreshModelFreshness, 60000);

render();
