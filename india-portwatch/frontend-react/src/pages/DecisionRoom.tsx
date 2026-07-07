/* AI Decision Room — what-if, why, what to do. */
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { api, Briefing, ScenarioPreset, ScenarioResult, fmt } from "../api";
import { AiBriefing, Badge, KV, Metric, Panel } from "../ui";

export default function DecisionRoom({ setMode }: { setMode: (m: string) => void }) {
  const [searchParams] = useSearchParams();
  const [presets, setPresets] = useState<ScenarioPreset[]>([]);
  const [sel, setSel] = useState("");
  const [intensity, setIntensity] = useState(1.0);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<ScenarioResult | null>(null);
  const [brief, setBrief] = useState<Briefing | null>(null);

  useEffect(() => {
    const simId = searchParams.get("sim");
    const simI = parseFloat(searchParams.get("i") ?? "1") || 1;
    api.scenarios().then(async (s) => {
      setPresets(s.data);
      const pick = simId && s.data.find((p) => p.id === simId) ? simId : s.data[0]?.id ?? "";
      setSel(pick);
      if (simId && pick === simId) {
        setIntensity(simI);
        setBusy(true);
        try { setRes((await api.simulate(pick, simI)).data); } finally { setBusy(false); }
      }
    });
    api.pins().then(async (p) => {
      setMode(p.data_mode);
      const worst = [...p.data].sort((a, b) => b.congestion_now - a.congestion_now)[0];
      if (worst) setBrief((await api.briefing(worst.port_id)).data);
    }).catch(() => {});
  }, []);

  const run = async () => {
    setBusy(true);
    try { setRes((await api.simulate(sel, intensity)).data); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">AI DECISION ROOM</div>
          <h1>What-if / Why / What to do</h1>
          <div className="sub">Shocks apply to the live forecast. Deltas are relative to today's model view.</div>
        </div>
      </div>

      {brief && <AiBriefing
        text={`Current national focus: ${brief.port_name}. ${brief.summary.split("Recommended action:")[0].trim()}`}
        action={brief.recommended_action} />}

      <div className="grid mt" style={{ gridTemplateColumns: "1fr 2.1fr" }}>
        <div>
          <div className="grid">
            {presets.map((p, i) => (
              <motion.div key={p.id} className={`panel scn ${p.id === sel ? "selected" : ""}`}
                onClick={() => setSel(p.id)} initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <div className="cat">{p.category}</div>
                <h4>{p.name}</h4>
                <p>{p.description}</p>
              </motion.div>
            ))}
          </div>
          <Panel title={`Intensity ${intensity.toFixed(1)}×`} className="mt">
            <input type="range" min={0.5} max={2} step={0.1} value={intensity}
              onChange={(e) => setIntensity(Number(e.target.value))} />
            <button className="btn mt" style={{ width: "100%" }} disabled={busy || !sel} onClick={run}>
              {busy ? "SIMULATING…" : "RUN SIMULATION"}
            </button>
          </Panel>
        </div>

        <div>
          <AnimatePresence mode="wait">
            {!res && (
              <motion.div key="empty" className="panel" exit={{ opacity: 0 }}>
                <h3>Impact</h3><div className="muted">Choose a scenario and run the simulation.</div>
              </motion.div>
            )}
            {res && (
              <motion.div key={res.scenario_id + res.intensity}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <div className="grid cols-3">
                  <Metric i={0} label="PORTS AFFECTED" value={res.affected_ports.length} />
                  <Metric i={1} label="RISK ESCALATIONS" tone="amber"
                    value={res.affected_ports.filter((p) => p.risk_after !== p.risk_before).length} />
                  <Metric i={2} label="WORST DELAY IMPACT" tone="red"
                    value={`+${fmt.n1(Math.max(...res.affected_ports.map((p) => p.delay_delta_hours), 0))}h`} />
                </div>
                <div className="mt">
                  <AiBriefing text={res.national_summary} action={res.recommended_response[0]} />
                </div>
                <div className="grid cols-3 mt">
                  {res.affected_ports.slice(0, 3).map((p, i) => (
                    <motion.div key={p.port_id} className="panel" initial={{ opacity: 0, scale: .95 }}
                      animate={{ opacity: 1, scale: 1 }} transition={{ delay: .2 + i * .1 }}>
                      <b>{p.port_name}</b>
                      <KV k="Congestion" v={<>
                        {fmt.n1(p.baseline_congestion)} {"->"} <b style={{ color: "var(--amber)" }}>
                        {fmt.n1(p.scenario_congestion)}</b> (+{fmt.n1(p.congestion_delta)})</>} />
                      <KV k="Delay" v={`+${fmt.n1(p.delay_delta_hours)}h`} />
                      <KV k="Throughput" v={`${fmt.n1(p.throughput_change_pct)}%`} />
                      <KV k="Risk" v={<><Badge level={p.risk_before} /> {"->"} <Badge level={p.risk_after} /></>} />
                    </motion.div>
                  ))}
                </div>
                <Panel title="Recommended response" className="mt">
                  {res.recommended_response.map((s, i) => (
                    <motion.div className="kv" key={i} initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }} transition={{ delay: .3 + i * .12 }}>
                      <span className="k">{">"}</span>
                      <span style={{ textAlign: "left", flex: 1, marginLeft: 10 }}>{s}</span>
                    </motion.div>
                  ))}
                  <details className="more"><summary>VIEW DETAILS - ALL AFFECTED PORTS</summary>
                    <table className="ops"><thead><tr>
                      <th>Port</th><th>ΔCongestion</th><th>ΔDelay</th><th>ΔThroughput</th><th>Risk</th>
                    </tr></thead><tbody>
                      {res.affected_ports.map((p) => (
                        <tr key={p.port_id}>
                          <td><Link to={`/ports/${p.port_id}`}>{p.port_name}</Link></td>
                          <td>+{fmt.n1(p.congestion_delta)}</td>
                          <td>+{fmt.n1(p.delay_delta_hours)}h</td>
                          <td>{fmt.n1(p.throughput_change_pct)}%</td>
                          <td><Badge level={p.risk_before} /> {"->"} <Badge level={p.risk_after} /></td>
                        </tr>
                      ))}
                    </tbody></table>
                  </details>
                </Panel>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
