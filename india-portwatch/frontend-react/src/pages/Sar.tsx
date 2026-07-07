/* SAR <PORT> — Sentinel-1 / GEE proxy vessel-activity report. */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, Pin, PortLive, SarReport, fmt } from "../api";
import { PortAreaMap } from "../maps";
import { KV, Panel } from "../ui";

export default function Sar({ setMode }: { setMode: (m: string) => void }) {
  const { portId = "JNPT" } = useParams();
  const [sar, setSar] = useState<SarReport | null>(null);
  const [pin, setPin] = useState<Pin | null>(null);
  const [live, setLive] = useState<PortLive | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    setSar(null);
    const id = portId.toUpperCase();
    Promise.all([api.sar(id), api.pin(id), api.live(id)])
      .then(([s, p, l]) => { setSar(s.data); setPin(p.data); setLive(l.data); setMode(s.data_mode); })
      .catch((e) => setErr(String(e)));
  }, [portId]);
  if (err) return <div className="panel mono" style={{ color: "var(--red)" }}>{err}</div>;
  if (!sar || !pin || !live) return <div className="loading">SAR {portId.toUpperCase()} ...</div>;
  const d = sar.change_vs_prev_pct;
  return (
    <>
      <div className="page-head">
        <div><div className="page-title">SATELLITE VESSEL ACTIVITY</div>
          <h1>SAR {sar.port_id}</h1>
          <div className="sub mono">{sar.mode} · scene {sar.scene_time}</div></div>
      </div>
      <div className="terminal-grid">
        <Panel title="Scene — anchorage and queue zones">
          <div className="area-wrap" style={{ height: 420 }}>
            <PortAreaMap port={pin} live={live} />
            <div className="sweep" />
            <div className="area-overlay">
              <span className="chip mock">{sar.mode}</span>
              <span className="chip">DETECTIONS {sar.vessel_detections}</span>
            </div>
          </div>
        </Panel>
        <div className="grid" style={{ alignContent: "start" }}>
          <div className="sar-scene">
            <div className="sar-zone" />
            {Array.from({ length: Math.min(34, sar.vessel_detections) }, (_, i) => (
              <span
                key={i}
                className={`sar-dot ${i % 5 === 0 ? "hot" : ""}`}
                style={{
                  left: `${18 + ((i * 37) % 68)}%`,
                  top: `${18 + ((i * 23) % 64)}%`,
                }}
              />
            ))}
            <div className="scene-readout">
              <div className="small">SENTINEL-1 / GOOGLE EARTH ENGINE PROXY</div>
              <div className="big">{sar.vessel_detections}</div>
              <div className="small">bright-object vessel detections</div>
            </div>
            <div className="proxy-label">AIS FALLBACK: PROXY / DEMO WHEN LIVE AIS IS MISSING</div>
          </div>
          <div className="terminal-band">
            <span className="label">COMMAND</span><strong>SAR {sar.port_id}</strong>
            <span className="label">SCENE</span><strong>{sar.scene_time}</strong>
          </div>
          <div className="wx-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="datum"><div className="k">Vessel detections</div>
              <div className="v">{sar.vessel_detections}</div><div className="u">in scene</div></div>
            <div className="datum"><div className="k">Anchorage density</div>
              <div className="v">{fmt.n1(sar.anchorage_density)}</div><div className="u">per 100 km²</div></div>
            <div className="datum"><div className="k">Queue zone activity</div>
              <div className={`v ${sar.queue_zone_activity >= 0.6 ? "red" : sar.queue_zone_activity >= 0.45 ? "amber" : ""}`}>
                {(sar.queue_zone_activity * 100).toFixed(0)}%</div></div>
            <div className="datum"><div className="k">Change vs prev scene</div>
              <div className={`v ${d > 15 ? "red" : d > 5 ? "amber" : ""}`}>
                {d > 0 ? "+" : ""}{fmt.n1(d)}%</div><div className="u">anchorage count</div></div>
          </div>
          <Panel title="Signal quality">
            <KV k="SAR confidence" v={sar.sar_confidence.toFixed(2)} />
            <KV k="Feeds" v="Port Ops / AIS Proxy Expert" />
            <KV k="AIS fallback status" v={sar.mode.includes("PROXY") ? "Proxy active" : "Live / mixed"} />
            <div className="spark-note">{sar.note}</div>
          </Panel>
          <Panel title="Operational meaning">
            <div className="ops-note">
              SAR detections and anchorage-density change are used as a port-ops signal when AIS is incomplete.
              Queue-zone activity above 60% raises berth waiting risk and contributes to HSMM congestion evidence.
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
