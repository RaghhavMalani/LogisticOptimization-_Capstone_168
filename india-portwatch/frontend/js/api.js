/* Thin typed-ish client for the Rust backend. */
const API = {
  async get(path) {
    const r = await fetch(path, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`${path} → HTTP ${r.status}`);
    return r.json();
  },
  async post(path, body) {
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`${path} → HTTP ${r.status}`);
    return r.json();
  },

  ports: () => API.get("/api/ports"),
  mapPins: () => API.get("/api/ports/map"),
  port: (id) => API.get(`/api/ports/${id}`),
  forecast: (id) => API.get(`/api/ports/${id}/forecast`),
  regime: (id) => API.get(`/api/ports/${id}/regime`),
  briefing: (id) => API.get(`/api/ports/${id}/briefing`),
  drivers: (id) => API.get(`/api/ports/${id}/drivers`),
  ships: () => API.get("/api/ships"),
  shipRec: (id) => API.get(`/api/ships/${id}/recommendation`),
  scenarios: () => API.get("/api/scenarios"),
  simulate: (scenario_id, intensity) =>
    API.post("/api/scenarios/simulate", { scenario_id, intensity }),
  alerts: () => API.get("/api/alerts"),
  analytics: () => API.get("/api/analytics/summary"),
  modelStatus: () => API.get("/api/model/status"),
};

/* Reflect backend data mode in the topbar chip. */
function setDataMode(mode) {
  const chip = document.getElementById("data-mode-chip");
  if (!chip || !mode) return;
  chip.textContent = mode === "real" ? "LIVE MODEL OUTPUTS"
    : mode === "partial" ? "PARTIAL / DEMO MIX" : "DEMO DATA";
  chip.className = `chip ${mode}`;
}
