/* Bloomberg-style command line. Ctrl+K or / focuses; Enter executes.
   Grammar: RADAR | PORT X | WX X | SAR X | NLP q | MODEL X |
            FORECAST X 10D | SIM scenario [intensity] | FLEET | WHY X topic */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const SCENARIO_ALIAS: Record<string, string> = {
  CYCLONE: "cyclone_east_coast", STORM: "storm_west_coast", STRIKE: "labor_strike",
  CAPACITY: "capacity_drop", DEMAND: "demand_surge", HORMUZ: "hormuz_closure",
  REDSEA: "red_sea_disruption", RED_SEA: "red_sea_disruption", FUEL: "fuel_price_shock",
  CYCLONE_EAST: "cyclone_east_coast", CYCLONE_EAST_COAST: "cyclone_east_coast",
  HORMUZ_CLOSE: "hormuz_closure", HORMUZ_CLOSURE: "hormuz_closure",
  PORT_CAPACITY_DROP: "capacity_drop", CAPACITY_DROP: "capacity_drop",
  LABOR_STRIKE: "labor_strike", LABOUR_STRIKE: "labor_strike",
  DEMAND_SURGE: "demand_surge", REDSEA_DISRUPTION: "red_sea_disruption",
};

export function parseCommand(raw: string): string | null {
  const t = raw.trim().split(/\s+/);
  if (!t[0]) return null;
  const cmd = t[0].toUpperCase();
  const a1 = (t[1] || "").toUpperCase();
  switch (cmd) {
    case "RADAR": case "HOME": return "/";
    case "PORT": return a1 ? `/ports/${a1}` : null;
    case "WX": return a1 ? `/wx/${a1}` : null;
    case "SAR": return a1 ? `/sar/${a1}` : null;
    case "NLP": return `/nlp${t.length > 1 ? `?q=${encodeURIComponent(t.slice(1).join(" "))}` : ""}`;
    case "MODEL": return a1 ? `/model/${a1}` : "/model";
    case "FORECAST": return a1 ? `/ports/${a1}` : null;
    case "FLEET": case "SHIPS": return "/ships";
    case "SIM": {
      if (!a1) return "/decision-room";
      const sid = SCENARIO_ALIAS[a1] ?? a1.toLowerCase();
      const inten = parseFloat(t[2]) || 1.0;
      return `/decision-room?sim=${sid}&i=${inten}`;
    }
    case "WHY": {
      if (!a1) return null;
      const topic = t.slice(2).join(" ") || "at risk";
      return `/model/${a1}?ask=${encodeURIComponent(`Why is ${a1} ${topic}?`)}`;
    }
    default: return null;
  }
}

export default function CommandBar() {
  const nav = useNavigate();
  const [v, setV] = useState("");
  const [err, setErr] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.key.toLowerCase() === "k") ||
          (e.key === "/" && !/input|textarea|select/i.test((e.target as HTMLElement).tagName))) {
        e.preventDefault(); ref.current?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  const run = () => {
    const to = parseCommand(v);
    if (to) { nav(to); setV(""); setErr(false); }
    else if (v.trim()) setErr(true);
  };
  return (
    <div className={`cmdbar ${err ? "err" : ""}`}>
      <span className="cmd-prompt">&gt;</span>
      <input ref={ref} value={v} spellCheck={false}
        placeholder="COMMAND: RADAR | PORT CHENNAI | WX CHENNAI | SAR CHENNAI | NLP HORMUZ | MODEL CHENNAI | SIM CYCLONE_EAST 1.5 | FLEET"
        onChange={(e) => { setV(e.target.value); setErr(false); }}
        onKeyDown={(e) => e.key === "Enter" && run()} />
      <button className="cmd-go" onClick={run}>EXEC</button>
    </div>
  );
}
