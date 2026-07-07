/* Ship Manager Fleet Board — operations console, not a dataframe. */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api, Ship, ShipRec } from "../api";
import { AiBriefing, Badge, KV, Panel } from "../ui";

export default function Fleet({ setMode }: { setMode: (m: string) => void }) {
  const [ships, setShips] = useState<Ship[]>([]);
  const [rec, setRec] = useState<ShipRec | null>(null);

  useEffect(() => {
    api.ships().then((s) => { setShips(s.data); setMode(s.data_mode); });
  }, []);

  const pick = async (id: string) =>
    setRec((await api.shipRec(id)).data);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">FLEET OPERATIONS</div>
          <h1>Ship Manager Board</h1>
          <div className="sub">{ships.length} vessels tracked · select a vessel for the full advisory</div>
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "1.8fr 1fr" }}>
        <div>
          <div className="fleet-head">
            <span>Vessel</span><span>Route</span><span>ETA window</span><span>Berth wait</span>
            <span>Entry risk</span><span>Best/Worst</span><span>Buffer</span><span>Conf</span>
          </div>
          {ships.map((s, i) => (
            <motion.div key={s.ship_id} className={`fleet-row ${rec?.ship_id === s.ship_id ? "sel" : ""}`}
              onClick={() => pick(s.ship_id)} initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
              <span><b>{s.name}</b></span>
              <span>{s.intended_port}{s.reroute &&
                <> {"->"} <b style={{ color: "var(--amber)" }}>{s.recommended_port}</b></>}</span>
              <span className="mono">{s.eta_window}</span>
              <span><Badge level={s.berth_waiting_risk} /></span>
              <span><Badge level={s.port_entry_risk} /></span>
              <span className="mono">+{s.best_arrival_day} / +{s.worst_arrival_day}</span>
              <span className="mono">{s.recommended_buffer_hours}h</span>
              <span><Badge level={s.confidence} /></span>
            </motion.div>
          ))}
        </div>
        <Panel title="Vessel advisory">
          {!rec && <div className="muted">Select a vessel from the board.</div>}
          {rec && (
            <motion.div key={rec.ship_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {rec.reroute && (
                <div className="ai-brief" style={{ marginBottom: 10 }}>
                  <div className="who">REROUTE ADVISED</div>
                  {rec.intended_port} {"->"} <b>{rec.recommended_port}</b><br />
                  <span className="muted small">{rec.reason}</span>
                </div>
              )}
              <KV k="Vessel" v={rec.name} />
              <KV k="Destination" v={`${rec.intended_port}${rec.reroute ? " -> " + rec.recommended_port : " (keep)"}`} />
              <KV k="Best arrival" v={`Day +${rec.best_arrival_day}`} />
              <KV k="Recommended buffer" v={`${rec.recommended_buffer_hours} h`} />
              <KV k="Berth waiting risk" v={<Badge level={rec.berth_waiting_risk} />} />
              <KV k="Port entry risk" v={<Badge level={rec.port_entry_risk} />} />
              <KV k="Confidence" v={<Badge level={rec.confidence} />} />
              <div className="mt">
                <AiBriefing text={rec.advisory} action={`Reason: ${rec.reason}`} speed={8} />
              </div>
            </motion.div>
          )}
        </Panel>
      </div>
    </>
  );
}
