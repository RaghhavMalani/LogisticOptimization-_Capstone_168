/* National Port Radar: FlightRadar-style landing screen for Indian ports. */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { api, Alert, Pin, Vessel, fmt } from "../api";
import { RadarMap } from "../maps";
import { Badge, Metric, Panel, StressGauge } from "../ui";

export default function Radar({ setMode }: { setMode: (m: string) => void }) {
  const nav = useNavigate();
  const [pins, setPins] = useState<Pin[]>([]);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    let dead = false;
    Promise.all([api.pins(), api.liveNational().catch(() => null), api.alerts()])
      .then(([p, l, a]) => {
        if (dead) return;
        setPins(p.data); setMode(p.data_mode);
        setVessels((l?.data ?? []).flatMap((x) => x.vessels));
        setAlerts(a.data);
      })
      .catch((e) => setErr(String(e)));
    const t = setInterval(() => api.alerts().then((a) => setAlerts(a.data)).catch(() => {}), 20000);
    return () => { dead = true; clearInterval(t); };
  }, []);

  if (err) return <div className="panel"><h3>ERROR</h3><div className="mono" style={{ color: "var(--red)" }}>{err}</div>
    <div className="muted mt">Is the backend running? <span className="mono">cargo run -p portwatch-backend</span></div></div>;
  if (!pins.length) return <div className="loading">ACQUIRING NATIONAL PICTURE…</div>;

  let num = 0, den = 0;
  for (const p of pins) { const w = p.port_capacity || 0.5; num += w * p.congestion_now; den += w; }
  const stress = den ? num / den : 0;
  const severe = pins.filter((p) => p.regime === "SEVERE");
  const congested = pins.filter((p) => p.regime === "CONGESTED");
  const top = [...pins].sort((a, b) => b.congestion_now - a.congestion_now).slice(0, 5);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">NATIONAL PORT RADAR</div>
          <h1>India Maritime Operations</h1>
          <div className="sub">{pins.length} ports · {vessels.length} tracked vessels{" "}
            <span className="badge info">AIS/SATELLITE PROXY MODE</span></div>
        </div>
        <div className="terminal-band">
          <span className="label">MODEL RUN</span><strong>LIVE</strong>
          <span className="label">VIEW</span><strong>NATIONAL OVERVIEW</strong>
        </div>
      </div>

      <div className="ticker" style={{ marginBottom: 12 }}>
        <div className="ticker-inner">
          {alerts.map((a, i) => (
            <span key={i} className={a.level === "severe" ? "sev" : a.level === "warning" ? "warn" : "info"}>
              [{a.level.toUpperCase()}] {a.port_id} - {a.message}
            </span>
          ))}
          {!alerts.length && <span className="info">All ports operating within normal parameters.</span>}
        </div>
      </div>

      <div className="terminal-grid">
        <div>
          <div className="radar-hero">
            <div className="map-topline">
              <span className="chip real">LIVE MODEL OUTPUTS</span>
              <span className="chip">WEATHER OVERLAY</span>
              <span className="chip mock">SAR/AIS PROXY VESSELS</span>
              <span className="chip">CHOKEPOINT ROUTES</span>
            </div>
            <RadarMap pins={pins} vessels={vessels} onSelect={(id) => nav(`/ports/${id}`)} height="calc(100vh - 286px)" />
            <div className="weather-map-overlay" aria-hidden="true">
              <span className="rain-band band-west" />
              <span className="rain-band band-east" />
              <span className="cyclone-swirl" />
            </div>
          </div>
          <div className="feedband">
            <span className="t">SYSTEM FEED</span>
            {top.slice(0, 3).map((p) => (
              <span key={p.port_id}>{p.port_id}: congestion {p.congestion_now.toFixed(0)} · delay {p.delay_hours.toFixed(1)}h · transition {(p.transition_risk * 100).toFixed(0)}%</span>
            ))}
          </div>
          <div className="grid cols-4 mt">
            <Metric i={0} label="SEVERE PORTS" value={severe.length} tone={severe.length ? "red" : ""}
              delta={severe.map((p) => p.port_id).join(" · ") || "none"} />
            <Metric i={1} label="CONGESTED PORTS" value={congested.length} tone={congested.length ? "amber" : ""} />
            <Metric i={2} label="MEAN CONGESTION" value={fmt.n1(stress)}
              tone={stress >= 60 ? "red" : stress >= 45 ? "amber" : ""} />
            <Metric i={3} label="VESSELS IN FIELD" value={vessels.length} delta="proxy signal" />
          </div>
        </div>
        <div className="grid" style={{ alignContent: "start" }}>
          <Panel title="National logistics stress" custom={0}>
            <StressGauge value={stress} />
            <div className="ops-note mt">
              Weighted port congestion is {fmt.n1(stress)}. Severe nodes, chokepoint exposure and proxy vessel density are combined into the operator view.
            </div>
          </Panel>
          <Panel title="Top 5 ports at risk" custom={1}>
            {top.map((p, i) => (
              <motion.div className="kv" key={p.port_id} initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
                <span className="k"><span className="muted mono">{i + 1}.</span>{" "}
                  <Link to={`/ports/${p.port_id}`}>{p.name}</Link></span>
                <span className="v">{fmt.n1(p.congestion_now)} <Badge level={p.regime} /></span>
              </motion.div>
            ))}
          </Panel>
          <Panel title="Active alerts" custom={2}>
            <div style={{ maxHeight: 260, overflowY: "auto" }}>
              {alerts.map((a, i) => (
                <div className="kv" key={i}>
                  <span className="k"><Badge level={a.level === "severe" ? "SEVERE" : a.level === "warning" ? "MEDIUM" : "INFO"} /></span>
                  <span style={{ fontSize: 12, textAlign: "left", flex: 1, marginLeft: 8 }}>
                    <Link to={`/ports/${a.port_id}`}>{a.port_id}</Link>{" "}
                    <span className="muted">{a.message}</span></span>
                </div>
              ))}
              {!alerts.length && <div className="muted">No active alerts.</div>}
            </div>
          </Panel>
          <Panel title="Chokepoint watch" custom={3}>
            <div className="chokepoint-list">
              <div className="chokepoint-row"><span>Hormuz Strait</span><b>CONGESTED</b></div>
              <div className="chokepoint-row"><span>Bab-el-Mandeb</span><b>CONGESTED</b></div>
              <div className="chokepoint-row"><span>Malacca Strait</span><b>SEVERE</b></div>
              <div className="chokepoint-row"><span>Suez Canal</span><b>NORMAL</b></div>
            </div>
          </Panel>
          <Panel title="Model pipeline" custom={4}>
            <div className="mono small muted" style={{ lineHeight: 1.9 }}>
              Weather - News/NLP - Port Ops - Demand<br />
              to HSMM Regime - TFT 10-Day Forecast - Decision Layer
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
