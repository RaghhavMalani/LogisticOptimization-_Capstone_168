/* NLP — news intelligence terminal view (+ optional query). */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, AskAnswer, NewsEvent } from "../api";
import { Badge, Panel } from "../ui";

export default function Nlp({ setMode }: { setMode: (m: string) => void }) {
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  const [news, setNews] = useState<NewsEvent[]>([]);
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  useEffect(() => {
    api.news().then((n) => { setNews(n.data); setMode(n.data_mode); });
    if (q) api.ask(q).then(setAnswer).catch(() => {});
  }, [q]);
  const shown = q
    ? news.filter((n) =>
        (n.headline + n.entity + n.event_type + n.affected_ports.join(" "))
          .toLowerCase().includes(q.toLowerCase()))
    : news;
  const list = shown.length ? shown : news;
  return (
    <>
      <div className="page-head">
        <div><div className="page-title">NEWS / NLP INTELLIGENCE</div>
          <h1>NLP {q && <span className="mono" style={{ fontSize: 14 }}>"{q}"</span>}</h1>
          <div className="sub">headlines · entities · event type · sentiment · risk · affected ports · model impact</div></div>
      </div>
      {answer && (
        <div className="ai-brief" style={{ marginBottom: 12 }}>
          <div className="who">PORTWATCH AI · {answer.method.toUpperCase()}</div>
          <div>{answer.answer}</div>
        </div>
      )}
      <div className="grid cols-2">
        {list.map((n, i) => (
          <Panel key={i} custom={i}>
            <div className="h" style={{ fontSize: 13.5 }}>{n.headline}</div>
            <div className="meta mt" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Badge level={n.risk_score >= 0.6 ? "HIGH" : n.risk_score >= 0.35 ? "MEDIUM" : "LOW"} />
              <span className="chip">entity {n.entity}</span>
              <span className="chip">type {n.event_type}</span>
              <span className="chip">sent {n.sentiment.toFixed(2)}</span>
              <span className="chip">risk {n.risk_score.toFixed(2)}</span>
              <span className="chip">conf {n.confidence.toFixed(2)}</span>
            </div>
            {n.affected_ports.length > 0 && (
              <div className="muted small mt">affected: {n.affected_ports.join(", ")}</div>
            )}
            <div className="small mt" style={{ color: "var(--mint)", fontFamily: "var(--mono)" }}>
              {n.model_impact}
            </div>
            <div className="muted small">{n.source} · {n.date}</div>
          </Panel>
        ))}
      </div>
    </>
  );
}
