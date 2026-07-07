/* Model Intelligence Layer — the visible AI: expert chain, news/NLP feed,
   pipeline health, and the Ask PortWatch query box. */
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  api, AskAnswer, Briefing, ModelStatus, NewsEvent, Port, PortForecast,
  PortIntel, RegimeTimeline, fmt,
} from "../api";
import { Badge, ExpertCards, KV, Panel } from "../ui";

export default function ModelIntel({ setMode }: { setMode: (m: string) => void }) {
  const routeParams = useParams();
  const [searchParams] = useSearchParams();
  const [ports, setPorts] = useState<Port[]>([]);
  const [portId, setPortId] = useState((routeParams.portId ?? "JNPT").toUpperCase());
  const [intel, setIntel] = useState<PortIntel | null>(null);
  const [regime, setRegime] = useState<RegimeTimeline | null>(null);
  const [forecast, setForecast] = useState<PortForecast | null>(null);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [status, setStatus] = useState<ModelStatus | null>(null);
  const [news, setNews] = useState<NewsEvent[]>([]);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    api.ports().then((p) => setPorts(p.data));
    api.modelStatus().then((s) => { setStatus(s); setMode(s.data_mode); });
    api.news().then((n) => setNews(n.data)).catch(() => {});
  }, []);
  useEffect(() => {
    setPortId((routeParams.portId ?? "JNPT").toUpperCase());
  }, [routeParams.portId]);
  useEffect(() => {
    setIntel(null); setRegime(null); setForecast(null); setBriefing(null);
    Promise.all([
      api.drivers(portId).then((i) => i.data).catch(() => null),
      api.regime(portId).then((r) => r.data).catch(() => null),
      api.forecast(portId).then((f) => f.data).catch(() => null),
      api.briefing(portId).then((b) => b.data).catch(() => null),
    ]).then(([i, r, f, b]) => {
      setIntel(i); setRegime(r); setForecast(f); setBriefing(b);
    });
  }, [portId]);
  useEffect(() => {
    const auto = searchParams.get("ask");
    if (auto) { setQ(auto); ask(auto); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ask = async (question: string) => {
    if (!question.trim()) return;
    setAsking(true);
    try { setAnswer(await api.ask(question)); } finally { setAsking(false); }
  };
  const suggestions = [
    `Why is ${portId} marked at risk?`,
    "What changed since yesterday?",
    "Which ports are most exposed to Hormuz closure?",
    "What is the best arrival day for MV Coromandel?",
  ];

  const chain = ["DATA", "EXPERTS", "HSMM REGIME", "TFT FORECAST", "DECISION", "ANALYTICS"];
  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">MODEL INTELLIGENCE LAYER</div>
          <h1>The visible AI</h1>
          <div className="sub mono">{status?.outputs_dir}</div>
        </div>
        <select value={portId} onChange={(e) => setPortId(e.target.value)}>
          {ports.map((p) => <option key={p.port_id} value={p.port_id}>{p.name}</option>)}
        </select>
      </div>

      <Panel title="Visible AI chain">
        <div className="model-flow">
          <div className="flow-node">
            <div className="step">EXPERTS</div>
            <div className="name">Weather / News / SAR / Demand</div>
            <div className="value">{intel?.expert_outputs.length ?? "--"}</div>
          </div>
          <div className="flow-node hot">
            <div className="step">HSMM REGIME</div>
            <div className="name">{regime?.current.current_regime ?? "Waiting"}</div>
            <div className="value">{regime ? `${(regime.current.p_severe * 100).toFixed(0)}%` : "--"}</div>
          </div>
          <div className="flow-node">
            <div className="step">TFT FORECAST</div>
            <div className="name">10-day quantile horizon</div>
            <div className="value">{briefing ? `D+${briefing.peak_congestion_day}` : forecast ? "10D" : "--"}</div>
          </div>
          <div className="flow-node">
            <div className="step">DECISION LAYER</div>
            <div className="name">{briefing?.recommended_action ?? "Awaiting briefing"}</div>
            <div className="value">{briefing ? fmt.n1(briefing.peak_delay_hours) + "h" : "--"}</div>
          </div>
        </div>
      </Panel>

      <Panel title="Pipeline health" className="mt">
        <div className="chain-row">
          {chain.map((c, i) => {
            const st = status?.pipeline.find((s) => s.stage === c);
            return (
              <motion.div key={c} className={`chain-node ${st?.status === "ok" ? "hot" : ""}`}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}>
                {c}<br />
                <span className="muted">{st ? `${fmt.n0(st.records)} rec · ${st.status.toUpperCase()}` : "—"}</span>
              </motion.div>
            );
          })}
        </div>
        <div className="spark-note">
          Weather - News/NLP - Port Ops/SAR - Demand - HSMM regime - TFT forecast - Decision layer
        </div>
      </Panel>

      <div className="grid cols-3 mt">
        <Panel title={`Expert chain — ${portId}`} custom={0}>
          <ExpertCards experts={intel?.expert_outputs} />
        </Panel>
        <Panel title="News / NLP intelligence" custom={1}>
          <div style={{ maxHeight: 420, overflowY: "auto" }}>
            {news.slice(0, 8).map((n, i) => (
              <motion.div className="news-card" key={i} initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <div className="h">{n.headline}</div>
                <div className="meta">
                  <Badge level={n.risk_score >= 0.6 ? "HIGH" : n.risk_score >= 0.35 ? "MEDIUM" : "LOW"} />
                  <span className="chip">{n.entity}</span>
                  <span className="chip">{n.event_type}</span>
                  <span className="chip">sent {n.sentiment.toFixed(2)}</span>
                  <span className="chip">conf {n.confidence.toFixed(2)}</span>
                </div>
                {n.affected_ports.length > 0 && (
                  <div className="muted small" style={{ marginTop: 4 }}>
                    affects: {n.affected_ports.join(", ")}
                  </div>
                )}
                <div className="impact">{n.model_impact}</div>
              </motion.div>
            ))}
            {!news.length && <div className="muted">No events in feed.</div>}
          </div>
        </Panel>
        <Panel title="Ask PortWatch" custom={2}>
          <form onSubmit={(e) => { e.preventDefault(); ask(q); }}>
            <input type="text" placeholder='e.g. "Why is Chennai marked medium risk?"'
              value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn mt" style={{ width: "100%" }} disabled={asking}>
              {asking ? "THINKING…" : "ASK"}
            </button>
          </form>
          <div className="mt" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {suggestions.map((s) => (
              <span key={s} className="chip" style={{ cursor: "pointer" }}
                onClick={() => { setQ(s); ask(s); }}>{s}</span>
            ))}
          </div>
            {answer && (
            <motion.div className="ai-brief mt" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="who">PORTWATCH AI / {answer.method.toUpperCase()}</div>
              <div>{answer.answer}</div>
              {answer.evidence.length > 0 && (
                <div className="mt">
                  {answer.evidence.map((e, i) => (
                    <div key={i} className="muted small">{">"} {e}</div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </Panel>
      </div>

      {status && (
        <div className="grid cols-3 mt">
          {status.pipeline.map((s) => (
            <Panel key={s.stage} title={s.stage}>
              <KV k="Status" v={<Badge level={s.status === "ok" ? "LOW" : s.status === "degraded" ? "MEDIUM" : "HIGH"} />} />
              <KV k="Latest run" v={s.latest_run ?? "—"} />
              <KV k="Records" v={fmt.n0(s.records)} />
              {s.warnings.length > 0 && <KV k="Warnings" v={<span style={{ color: "var(--amber)" }}>{s.warnings.join("; ")}</span>} />}
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
