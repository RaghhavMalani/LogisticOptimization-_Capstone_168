/* Router + pages for the India PortWatch command center. */

const view = () => document.getElementById("view");

/* ------------------------------------------------------------ router */
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
  const path = location.pathname;
  try {
    if (path === "/" || path === "") return await pageCommand();
    let m;
    if ((m = path.match(/^\/ports\/([^/]+)$/))) return await pageCockpit(m[1].toUpperCase());
    if (path === "/ships") return await pageShips();
    if (path === "/scenarios") return await pageScenarios();
    if (path === "/analytics") return await pageAnalytics();
    if (path === "/model") return await pageModel();
    return await pageCommand();
  } catch (err) {
    view().innerHTML = `<div class="panel"><h3>ERROR</h3>
      <div class="mono" style="color:var(--red)">${esc(err.message)}</div>
      <div class="muted mt">Is the backend running? <span class="mono">cargo run -p portwatch-backend</span></div></div>`;
  }
}

/* --------------------------------------------------- 1. command deck */
async function pageCommand() {
  setActiveNav("command");
  const [pinsEnv, alertsEnv, statusRes] = await Promise.all([
    API.mapPins(), API.alerts(), API.modelStatus(),
  ]);
  setDataMode(pinsEnv.data_mode);
  const pins = pinsEnv.data;
  const summaryEnv = await API.analytics();
  const nat = summaryEnv.data.national;

  view().innerHTML = `
    <div class="page-head">
      <div><div class="page-title">NATIONAL OPERATIONS</div>
        <h1>Command Dashboard</h1>
        <div class="sub">${pins.length} ports under surveillance · forecasts to Day +10</div></div>
    </div>
    <div class="grid cols-4">
      ${MetricCard({ label: "MEAN CONGESTION INDEX", value: fmt.n1(nat.mean_congestion),
        tone: nat.mean_congestion >= 60 ? "red" : nat.mean_congestion >= 45 ? "amber" : "" })}
      ${MetricCard({ label: "SEVERE REGIME PORTS", value: nat.severe_ports.length,
        tone: nat.severe_ports.length ? "red" : "", delta: nat.severe_ports.join(" · ") || "none" })}
      ${MetricCard({ label: "CONGESTED PORTS", value: nat.congested_count,
        tone: nat.congested_count ? "amber" : "" })}
      ${MetricCard({ label: "DATA MODE", value: pinsEnv.data_mode.toUpperCase(),
        tone: pinsEnv.data_mode === "real" ? "" : "amber",
        delta: statusRes.outputs_dir })}
    </div>

    <div class="grid mt" style="grid-template-columns: 2.2fr 1fr;">
      <div>
        <div id="map-wrap"><div id="map"></div>${MapLegend()}</div>
      </div>
      <div class="grid" style="align-content:start">
        <div class="panel"><h3>Top risk ports</h3>
          ${nat.top_risk_ports.map((p, i) => `
            <div class="kv"><span class="k"><span class="rank-num">${i + 1}.</span>
              <a href="/ports/${esc(p.port_id)}" data-link>${esc(p.name)}</a></span>
              <span class="v">${fmt.n1(p.congestion)} ${RegimeBadge(p.regime)}</span></div>`).join("")}
        </div>
        <div class="panel"><h3>Active alerts</h3>
          <div style="max-height:270px;overflow-y:auto">${AlertsFeed(alertsEnv.data)}</div>
        </div>
        <div class="panel"><h3>Model readiness</h3>
          ${statusRes.pipeline.map((s) => KV(s.stage,
            `<span class="badge ${esc(s.status === "ok" ? "low" : s.status === "degraded" ? "medium" : "high")}">${esc(s.status.toUpperCase())}</span>`)).join("")}
        </div>
      </div>
    </div>`;

  renderPortMap(document.getElementById("map"), pins);
}

/* --------------------------------------------------- 2. port cockpit */
async function pageCockpit(portId) {
  setActiveNav("cockpit");
  view().innerHTML = `<div class="loading">LOADING ${esc(portId)} COCKPIT…</div>`;

  const [ports, pinEnv, fcEnv, regEnv, briefEnv, drvEnv] = await Promise.all([
    API.ports(),
    API.port(portId),
    API.forecast(portId).catch(() => null),
    API.regime(portId).catch(() => null),
    API.briefing(portId).catch(() => null),
    API.drivers(portId).catch(() => null),
  ]);
  setDataMode(pinEnv.data_mode);
  const pin = pinEnv.data;
  const fc = fcEnv?.data;
  const reg = regEnv?.data;
  const brief = briefEnv?.data;

  const selector = `<select id="port-select">${ports.data
    .map((p) => `<option value="${esc(p.port_id)}" ${p.port_id === pin.port_id ? "selected" : ""}>${esc(p.name)}</option>`)
    .join("")}</select>`;

  const cur = reg?.current;
  view().innerHTML = `
    <div class="page-head">
      <div><div class="page-title">PORT COCKPIT — ${esc(pin.region).toUpperCase()} COAST</div>
        <h1>${esc(pin.name)} ${RegimeBadge(pin.regime)}</h1>
        <div class="sub">${fc ? `forecast origin ${esc(fc.origin_date)} · model: ${esc(fc.model)}` : "no forecast available"}</div></div>
      <div>${selector}</div>
    </div>

    <div class="grid cols-4">
      ${MetricCard({ label: "CONGESTION (DAY +1)", value: fmt.n1(pin.congestion_now),
        tone: pin.congestion_now >= 60 ? "red" : pin.congestion_now >= 45 ? "amber" : "" })}
      ${MetricCard({ label: "EXPECTED DELAY (H)", value: fmt.n1(pin.delay_hours),
        tone: pin.delay_hours >= 18 ? "red" : pin.delay_hours >= 10 ? "amber" : "" })}
      ${MetricCard({ label: "THROUGHPUT (T/DAY)", value: fmt.n0(pin.throughput) })}
      ${MetricCard({ label: "TRANSITION RISK", value: fmt.pct(pin.transition_risk),
        tone: pin.transition_risk >= 0.3 ? "amber" : "" })}
    </div>

    <div class="grid cols-2 mt">
      <div class="panel">
        ${ForecastTimeline(fc?.horizon, { title: "10-day congestion forecast" })}
      </div>
      <div class="panel">
        ${BarTimeline(fc?.horizon, "delay_hours", { label: "Delay forecast (hours)", color: "var(--amber)" })}
        ${BarTimeline(fc?.horizon, "throughput", { label: "Throughput forecast (tonnes/day)", color: "var(--cyan)" })}
      </div>
    </div>

    <div class="grid cols-2 mt">
      <div class="panel">
        <h3>HSMM regime — last 45 days</h3>
        ${RegimeTimelineStrip(reg?.history)}
        <div class="mt"></div>
        ${cur ? [
          KV("Current regime", RegimeBadge(cur.current_regime)),
          KV("P(normal / congested / severe)",
            `${fmt.pct(cur.p_normal)} / ${fmt.pct(cur.p_congested)} / ${fmt.pct(cur.p_severe)}`),
          KV("Days in state", fmt.n1(cur.days_in_state)),
          KV("Expected remaining", `${fmt.n1(cur.expected_remaining_days)} d`),
          KV("Transition risk", fmt.pct(cur.transition_risk)),
          KV("Confidence", esc(cur.confidence)),
        ].join("") : `<div class="muted">No regime state.</div>`}
      </div>
      <div class="panel">
        <h3>Condition drivers</h3>
        ${DriverPanel(drvEnv?.data?.drivers)}
        <div class="mt"></div>
        ${brief ? [
          KV("Peak congestion", `Day +${brief.peak_congestion_day} · q50 ${fmt.n1(brief.peak_congestion_q50)} · q90 ${fmt.n1(brief.peak_congestion_q90)}`),
          KV("Peak delay", `${fmt.n1(brief.peak_delay_hours)} h`),
          KV("Weather impact", RiskBadge(brief.weather_impact)),
          KV("Capacity risk", RiskBadge(brief.capacity_risk)),
          KV("High-risk days", brief.high_risk_days.length ? brief.high_risk_days.map((d) => `+${d}`).join(", ") : "none"),
        ].join("") : ""}
      </div>
    </div>

    ${brief ? `<div class="panel mt">
      <h3>Operational briefing</h3>
      <div class="action-panel">${esc(brief.summary)}</div>
    </div>` : ""}`;

  document.getElementById("port-select").addEventListener("change", (e) =>
    navigate(`/ports/${e.target.value}`));
}

/* -------------------------------------------------------- 3. ships */
async function pageShips() {
  setActiveNav("ships");
  const env = await API.ships();
  setDataMode(env.data_mode);
  const ships = env.data;

  view().innerHTML = `
    <div class="page-head">
      <div><div class="page-title">FLEET PLANNING</div><h1>Ship Manager</h1>
        <div class="sub">${ships.length} vessels tracked · click a vessel for the full advisory</div></div>
    </div>
    <div class="grid" style="grid-template-columns: 1.7fr 1fr">
      <div class="panel">
        <h3>Fleet operations board</h3>
        <table class="ops"><thead><tr>
          <th>Vessel</th><th>Route</th><th>ETA window</th><th>Berth wait</th>
          <th>Entry risk</th><th>Best / worst day</th><th>Buffer</th><th>Conf.</th>
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

/* ---------------------------------------------------- 4. scenarios */
async function pageScenarios() {
  setActiveNav("scenarios");
  const env = await API.scenarios();
  const presets = env.data;
  let selected = presets[0]?.id;

  view().innerHTML = `
    <div class="page-head">
      <div><div class="page-title">WHAT-IF ENGINE</div><h1>Scenario Simulator</h1>
        <div class="sub">Shocks are applied to the live forecast — deltas are relative to today's model view</div></div>
    </div>
    <div class="grid" style="grid-template-columns: 1fr 2fr">
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
    <div class="panel mt"><h3>${esc(r.scenario_name)} — national impact</h3>
      <div class="action-panel">${esc(r.national_summary)}</div>
      <div class="grid cols-3 mt">
        ${worst.map((p) => `<div class="panel">
          <b>${esc(p.port_name)}</b><div class="mt"></div>
          ${KV("Congestion", `${fmt.n1(p.baseline_congestion)} → <b style="color:var(--amber)">${fmt.n1(p.scenario_congestion)}</b>`)}
          ${KV("Delay", `${fmt.n1(p.baseline_delay_hours)}h → <b style="color:var(--amber)">${fmt.n1(p.scenario_delay_hours)}h</b>`)}
          ${KV("Throughput", `${fmt.n1(p.throughput_change_pct)}%`)}
          ${KV("Risk", `${RiskBadge(p.risk_before)} → ${RiskBadge(p.risk_after)}`)}
        </div>`).join("")}
      </div>
    </div>
    <div class="panel mt"><h3>All affected ports</h3>
      <table class="ops"><thead><tr><th>Port</th><th>ΔCongestion</th><th>ΔDelay</th><th>ΔThroughput</th><th>Risk</th></tr></thead>
      <tbody>${r.affected_ports.map((p) => `<tr>
        <td><a href="/ports/${esc(p.port_id)}" data-link>${esc(p.port_name)}</a></td>
        <td>+${fmt.n1(p.congestion_delta)}</td><td>+${fmt.n1(p.delay_delta_hours)}h</td>
        <td>${fmt.n1(p.throughput_change_pct)}%</td>
        <td>${RiskBadge(p.risk_before)} → ${RiskBadge(p.risk_after)}</td></tr>`).join("")}
      </tbody></table>
    </div>
    <div class="panel mt"><h3>Recommended response</h3>
      ${r.recommended_response.map((s) => `<div class="kv"><span class="k">▸</span><span style="text-align:left;flex:1;margin-left:10px">${esc(s)}</span></div>`).join("")}
    </div>`;
}

/* ---------------------------------------------------- 5. analytics */
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
          </tbody></table>` : `<div class="muted">No backtest metrics found — run the pipeline with walk-forward enabled.</div>`}
      </div>
    </div>`;
}

/* -------------------------------------------------------- 6. model */
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

/* ------------------------------------------------------------ clock */
setInterval(() => {
  const el = document.getElementById("utc-clock");
  if (el) el.textContent = new Date().toISOString().slice(0, 19).replace("T", " ") + "Z";
}, 1000);

render();
