/* Shared command-center components. */
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Driver, ExpertOutput, ForecastPoint, RegimeState, fmt } from "./api";

export const rise = {
  hidden: { opacity: 0, y: 10 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35 } }),
};

export function Panel({ title, children, className = "", custom = 0 }: {
  title?: string; children: React.ReactNode; className?: string; custom?: number;
}) {
  return (
    <motion.div className={`panel ${className}`} variants={rise} initial="hidden"
      animate="show" custom={custom}>
      {title && <h3>{title}</h3>}
      {children}
    </motion.div>
  );
}

export function Metric({ label, value, tone = "", delta = "", i = 0 }: {
  label: string; value: React.ReactNode; tone?: string; delta?: string; i?: number;
}) {
  return (
    <motion.div className="panel metric" variants={rise} initial="hidden" animate="show" custom={i}>
      <div className={`value ${tone}`}>{value}</div>
      <div className="label">{label}</div>
      {delta && <div className="delta">{delta}</div>}
    </motion.div>
  );
}

export const Badge = ({ level }: { level?: string }) => (
  <span className={`badge ${String(level || "low").toLowerCase()}`}>
    {String(level || "LOW").toUpperCase()}
  </span>
);

export const KV = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="kv"><span className="k">{k}</span><span className="v">{v}</span></div>
);

/* Typewriter AI briefing. */
export function AiBriefing({ text, action, speed = 14 }: { text: string; action?: string; speed?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => { setN(0); }, [text]);
  useEffect(() => {
    if (n >= text.length) return;
    const t = setTimeout(() => setN((x) => Math.min(x + 3, text.length)), speed);
    return () => clearTimeout(t);
  }, [n, text, speed]);
  const done = n >= text.length;
  return (
    <motion.div className="ai-brief" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="who">PORTWATCH AI / OPERATIONAL BRIEFING</div>
      <div className={done ? "" : "caret"}>{text.slice(0, n)}</div>
      {done && action && <motion.div className="act" initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}>{">"} {action}</motion.div>}
    </motion.div>
  );
}

/* 10-day risk tiles, animated left → right. */
const driverIcon: Record<string, string> = {
  LOW: "OK", MEDIUM: "MED", HIGH: "HIGH", CRITICAL: "CRIT",
};
export function RiskTiles({ horizon }: { horizon?: ForecastPoint[] }) {
  if (!horizon?.length) return <div className="muted">No forecast.</div>;
  const peak = horizon.reduce((a, b) => (b.congestion_q50 > a.congestion_q50 ? b : a)).day;
  return (
    <div className="risk-tiles">
      {horizon.map((h, i) => (
        <motion.div key={h.day}
          className={`risk-tile ${h.risk} ${h.day === peak ? "peak" : ""}`}
          initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.06 }}
          title={`conf ${h.confidence} · ${h.target_date}`}>
          <div className="d">DAY +{h.day}</div>
          <div className="lvl">{h.risk}</div>
          <div className="dl">{fmt.n1(h.delay_hours)}h</div>
          <div className="q">q50 {fmt.n0(h.congestion_q50)} · q90 {fmt.n0(h.congestion_q90)}</div>
          <div className="ic">{driverIcon[h.risk] ?? "·"}</div>
        </motion.div>
      ))}
    </div>
  );
}

/* Animated HSMM probability bars. */
export function RegimeProbs({ cur }: { cur?: RegimeState }) {
  if (!cur) return <div className="muted">No regime state.</div>;
  const rows = [
    ["Normal", cur.p_normal, "var(--green)"],
    ["Congested", cur.p_congested, "var(--amber)"],
    ["Severe", cur.p_severe, "var(--red)"],
  ] as const;
  return (
    <>
      {rows.map(([label, p, color]) => (
        <div className="prob-row" key={label}>
          <span>{label}</span>
          <div className="prob-bar">
            <motion.div className="prob-fill" style={{ background: color }}
              initial={{ width: 0 }} animate={{ width: `${p * 100}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }} />
          </div>
          <span className="num">{(p * 100).toFixed(0)}%</span>
        </div>
      ))}
      <div className="mt" />
      <KV k="Days in state" v={fmt.n1(cur.days_in_state)} />
      <KV k="Expected remaining" v={`${fmt.n1(cur.expected_remaining_days)} days`} />
      <KV k="Transition risk" v={`${(cur.transition_risk * 100).toFixed(1)}%`} />
      <KV k="State confidence" v={<Badge level={cur.confidence} />} />
    </>
  );
}

const srcOf = (name: string) =>
  /queue|vessel/i.test(name) ? "Port Ops Expert"
  : /weather|wind|storm/i.test(name) ? "Weather Expert"
  : /demand/i.test(name) ? "Demand Expert"
  : /geo|shock|event/i.test(name) ? "News Expert" : "Port Ops Expert";

export function DriverCards({ drivers }: { drivers?: Driver[] }) {
  if (!drivers?.length) return <div className="muted">No driver data.</div>;
  return (
    <>
      {drivers.map((d, i) => {
        const heat = d.value >= 0.65 ? "hot" : d.value >= 0.45 ? "warm" : "";
        const arrow = d.trend === "rising" ? "UP" : d.trend === "falling" ? "DOWN" : "FLAT";
        return (
          <motion.div className={`driver-card ${heat}`} key={d.name}
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.07 }}>
            <div className="t"><span>{i + 1}. {d.name}</span>
              <span className={`arrow ${d.trend}`}>{arrow} {(d.value * 100).toFixed(0)}%</span></div>
            <div className="d">{d.detail}</div>
            <div className="src">{srcOf(d.name)}</div>
          </motion.div>
        );
      })}
    </>
  );
}

export function ExpertCards({ experts }: { experts?: ExpertOutput[] }) {
  if (!experts?.length) return <div className="muted">No expert outputs.</div>;
  return (
    <>
      {experts.map((e, i) => (
        <motion.div className="expert-card" key={e.expert}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}>
          <div>
            <div className="name">{e.expert}</div>
            <div className="sig">{e.signal}</div>
            <div className="muted small">in: {e.input_signal}</div>
            <div className="small" style={{ color: "var(--mint)" }}>fx: {e.effect}</div>
            <div className="muted small">{e.detail}</div>
          </div>
          <div className="conf">conf<br /><b>{e.confidence.toFixed(2)}</b><br />
            <span className="small">{e.last_run}</span></div>
        </motion.div>
      ))}
    </>
  );
}

/* Semi-circular stress gauge. */
export function StressGauge({ value, label = "NATIONAL LOGISTICS STRESS" }:
  { value: number; label?: string }) {
  const v = Math.max(0, Math.min(100, value || 0));
  const R = 34, C = Math.PI * R;
  const color = v >= 60 ? "var(--red)" : v >= 45 ? "var(--amber)" : "var(--mint)";
  return (
    <div className="gauge-wrap">
      <svg width="96" height="58" viewBox="0 0 96 58">
        <path d="M 10 52 A 34 34 0 0 1 86 52" fill="none" stroke="var(--line)"
          strokeWidth="9" strokeLinecap="round" />
        <motion.path d="M 10 52 A 34 34 0 0 1 86 52" fill="none" stroke={color}
          strokeWidth="9" strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${C}` }}
          animate={{ strokeDasharray: `${(C * v) / 100} ${C}` }}
          transition={{ duration: 1, ease: "easeOut" }} />
      </svg>
      <div>
        <div className="gauge-num" style={{ color }}>{v.toFixed(0)}</div>
        <div className="gauge-label">{label}</div>
      </div>
    </div>
  );
}

/* Capacity utilisation ring for the digital twin panel. */
export function UtilRing({ value }: { value: number }) {
  const v = Math.max(0, Math.min(1, value));
  const R = 20, C = 2 * Math.PI * R;
  const color = v >= 0.85 ? "var(--red)" : v >= 0.65 ? "var(--amber)" : "var(--mint)";
  return (
    <svg width="54" height="54" viewBox="0 0 54 54" className="util-ring">
      <circle cx="27" cy="27" r={R} fill="rgba(7,11,20,.8)" stroke="var(--line)" strokeWidth="5" />
      <motion.circle cx="27" cy="27" r={R} fill="none" stroke={color} strokeWidth="5"
        strokeLinecap="round" transform="rotate(-90 27 27)"
        initial={{ strokeDasharray: `0 ${C}` }}
        animate={{ strokeDasharray: `${C * v} ${C}` }}
        transition={{ duration: 1 }} />
      <text x="27" y="31" textAnchor="middle" fill={color}
        style={{ font: "10px var(--mono)" }}>{(v * 100).toFixed(0)}%</text>
    </svg>
  );
}
