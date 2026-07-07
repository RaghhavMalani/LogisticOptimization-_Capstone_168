/* India PortWatch Terminal — command-driven AI maritime operations shell. */
import { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter, NavLink, Route, Routes, useLocation,
} from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import "./theme.css";
import { api, Alert, NewsEvent, Pin, fmt } from "./api";
import CommandBar from "./CommandBar";
import Radar from "./pages/Radar";
import Wx from "./pages/Wx";
import Sar from "./pages/Sar";
import Nlp from "./pages/Nlp";
import Cockpit from "./pages/Cockpit";
import DecisionRoom from "./pages/DecisionRoom";
import Fleet from "./pages/Fleet";
import ModelIntel from "./pages/ModelIntel";

function Clock() {
  const [t, setT] = useState("");
  useEffect(() => {
    const i = setInterval(() =>
      setT(new Date().toISOString().slice(0, 19).replace("T", " ") + "Z"), 1000);
    return () => clearInterval(i);
  }, []);
  return <span className="clock">{t}</span>;
}

function ModelFresh() {
  const [t, setT] = useState("—");
  useEffect(() => {
    const load = () => api.modelStatus().then((s) => {
      const tft = s.pipeline.find((p) => p.stage === "TFT FORECAST");
      setT(tft?.latest_run ?? "—");
    }).catch(() => {});
    load();
    const i = setInterval(load, 60000);
    return () => clearInterval(i);
  }, []);
  return <span className="chip" title="latest model run">MODEL {t}</span>;
}

const NAV = [
  ["/", "RADAR", "National Radar"],
  ["/ports/CHENNAI", "PORT", "Port Cockpit"],
  ["/wx/CHENNAI", "WX", "Weather Intel"],
  ["/sar/CHENNAI", "SAR", "SAR Proxy"],
  ["/nlp?q=HORMUZ", "NLP", "News Intel"],
  ["/model/CHENNAI", "MODEL", "AI Pipeline"],
  ["/decision-room", "SIM", "Decision Room"],
  ["/ships", "FLEET", "Fleet Board"],
] as const;

function RightRail() {
  const [pins, setPins] = useState<Pin[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [news, setNews] = useState<NewsEvent[]>([]);

  useEffect(() => {
    const load = () => {
      api.pins().then((r) => setPins(r.data)).catch(() => {});
      api.alerts().then((r) => setAlerts(r.data)).catch(() => {});
      api.news().then((r) => setNews(r.data)).catch(() => {});
    };
    load();
    const i = setInterval(load, 30000);
    return () => clearInterval(i);
  }, []);

  const top = [...pins].sort((a, b) => b.congestion_now - a.congestion_now).slice(0, 5);
  const stress = pins.length
    ? pins.reduce((sum, p) => sum + p.congestion_now, 0) / pins.length
    : 0;

  return (
    <aside className="intelrail">
      <section className="rail-panel stress-panel">
        <div className="rail-kicker">NATIONAL LOGISTICS STRESS</div>
        <div className="stress-readout">
          <div>
            <span className="stress-number">{fmt.n0(stress)}</span>
            <span className="stress-unit">/100</span>
          </div>
          <span className={stress >= 60 ? "status-red" : stress >= 45 ? "status-amber" : "status-green"}>
            {stress >= 60 ? "ELEVATED" : stress >= 45 ? "WATCH" : "NORMAL"}
          </span>
        </div>
        <div className="micro-spark" aria-hidden="true">
          {Array.from({ length: 22 }, (_, i) => (
            <span key={i} style={{ height: `${28 + ((i * 17 + Math.round(stress)) % 42)}%` }} />
          ))}
        </div>
      </section>

      <section className="rail-panel">
        <div className="rail-title">
          <span>Top Ports At Risk</span>
          <span>{top.length ? "LIVE" : "WAIT"}</span>
        </div>
        <div className="rank-list">
          {top.map((p, i) => (
            <a href={`/ports/${p.port_id}`} className="rank-row" key={p.port_id}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <b>{p.port_id}</b>
              <em>{fmt.n0(p.congestion_now)}</em>
              <small className={`risk-word ${p.regime.toLowerCase()}`}>{p.regime}</small>
            </a>
          ))}
        </div>
      </section>

      <section className="rail-panel rail-fill">
        <div className="rail-title">
          <span>Active Alerts</span>
          <span>{String(alerts.length).padStart(2, "0")}</span>
        </div>
        <div className="alert-stack">
          {alerts.slice(0, 8).map((a, i) => (
            <div className="alert-row" key={`${a.port_id}-${i}`}>
              <span className={`alert-level ${a.level}`}>{a.level.toUpperCase()}</span>
              <p><b>{a.port_id}</b> {a.message}</p>
            </div>
          ))}
          {!alerts.length && <p className="muted small">No active alerts.</p>}
        </div>
      </section>

      <section className="rail-panel">
        <div className="rail-title">
          <span>AI Operator Summary</span>
          <span>MODEL</span>
        </div>
        <p className="ai-summary">
          {top[0]
            ? `${top[0].port_id} is the current national focus. Weather, SAR proxy activity, NLP events and demand signals are feeding HSMM regime state and TFT forecast output.`
            : "Waiting for live model outputs from the backend."}
        </p>
        {news[0] && (
          <div className="rail-news">
            <span>NLP EVENT</span>
            <p>{news[0].headline}</p>
          </div>
        )}
      </section>
    </aside>
  );
}

function App() {
  const [mode, setMode] = useState("mock");
  const loc = useLocation();
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" />
          <span className="brand-name">INDIA <b>PORTWATCH</b></span>
          <span className="brand-sub">AI MARITIME COMMAND</span>
        </div>
        <div className="top-right">
          <ModelFresh />
          <span className={`chip ${mode}`}>
            {mode === "real" ? "LIVE MODEL OUTPUTS" : mode === "partial" ? "PARTIAL / DEMO MIX" : "DEMO / PROXY MODE"}
          </span>
          <Clock />
        </div>
      </header>
      <nav className="navrail">
        {NAV.map(([to, ico, label]) => (
          <NavLink key={to} to={to} end={to === "/"}
            className={({ isActive }) =>
              `nav-item ${isActive || (to.startsWith("/ports") && loc.pathname.startsWith("/ports")) ? "active" : ""}`}>
            <span className="nav-ico">{ico}</span><span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <main className="main">
        <AnimatePresence mode="wait">
          <motion.div key={loc.pathname}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28 }}>
            <Routes location={loc}>
              <Route path="/" element={<Radar setMode={setMode} />} />
              <Route path="/ports/:portId" element={<Cockpit setMode={setMode} />} />
              <Route path="/decision-room" element={<DecisionRoom setMode={setMode} />} />
              <Route path="/decision" element={<DecisionRoom setMode={setMode} />} />
              <Route path="/ships" element={<Fleet setMode={setMode} />} />
              <Route path="/wx/:portId" element={<Wx setMode={setMode} />} />
              <Route path="/sar/:portId" element={<Sar setMode={setMode} />} />
              <Route path="/nlp" element={<Nlp setMode={setMode} />} />
              <Route path="/model/:portId" element={<ModelIntel setMode={setMode} />} />
              <Route path="/model" element={<ModelIntel setMode={setMode} />} />
              <Route path="*" element={<Radar setMode={setMode} />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
      <RightRail />
      <footer className="terminal-footer">
        <CommandBar />
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
