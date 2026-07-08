import { createFileRoute } from "@tanstack/react-router";
import { Chip, Sparkline } from "@/components/terminal/ui";
import { NLP_HEADLINES, PIPELINE, PORTS, ALERTS } from "@/data/portwatch";
import indiaSat from "@/assets/india-satellite.jpg";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({
  component: RadarPage,
});

// Port positions in normalized coords over the satellite image (0..1)
const PORT_POS: Record<string, { x: number; y: number }> = {
  INMUN: { x: 0.28, y: 0.36 }, // Mundra
  INIXY: { x: 0.31, y: 0.34 }, // Kandla / Deendayal
  INBOM: { x: 0.36, y: 0.51 }, // Mumbai
  INNSA: { x: 0.365, y: 0.53 }, // JNPT
  INMRM: { x: 0.39, y: 0.59 }, // Mormugao
  ININM: { x: 0.41, y: 0.65 }, // New Mangalore
  INCOK: { x: 0.44, y: 0.73 }, // Cochin
  INTUT: { x: 0.485, y: 0.77 }, // Tuticorin
  INMAA: { x: 0.55, y: 0.63 }, // Chennai
  INENR: { x: 0.552, y: 0.615 },// Ennore/Kamarajar
  INVTZ: { x: 0.585, y: 0.53 }, // Vizag
  INPRT: { x: 0.615, y: 0.44 }, // Paradip
  INHAL: { x: 0.63, y: 0.375 }, // Kolkata/Haldia
};

const CHOKES: { code: string; label: string; sub: string; tone: "cyan"|"amber"|"red"|"mint"; x: number; y: number }[] = [
  { code: "SUEZ", label: "SUEZ CANAL",     sub: "Transit: Normal",    tone: "mint",  x: 0.06, y: 0.10 },
  { code: "HRMZ", label: "HORMUZ STRAIT",  sub: "Transit: Congested", tone: "amber", x: 0.18, y: 0.28 },
  { code: "BAB",  label: "BAB-EL-MANDEB",  sub: "Transit: Congested", tone: "amber", x: 0.14, y: 0.66 },
  { code: "MLC",  label: "MALACCA STRAIT", sub: "Transit: Severe",    tone: "red",   x: 0.94, y: 0.82 },
];

// Deterministic vessel proxies scattered over Arabian Sea + Bay of Bengal
const VESSEL_PROXIES: { x: number; y: number; h: number; t: "cargo"|"tanker"|"other" }[] = [
  { x: 0.22, y: 0.44, h: 40,  t: "cargo" },  { x: 0.26, y: 0.50, h: 55,  t: "tanker" },
  { x: 0.30, y: 0.58, h: 90,  t: "cargo" },  { x: 0.34, y: 0.62, h: 110, t: "other" },
  { x: 0.20, y: 0.60, h: 20,  t: "cargo" },  { x: 0.16, y: 0.52, h: 350, t: "tanker" },
  { x: 0.12, y: 0.42, h: 10,  t: "cargo" },  { x: 0.24, y: 0.36, h: 70,  t: "tanker" },
  { x: 0.32, y: 0.72, h: 180, t: "cargo" },  { x: 0.40, y: 0.80, h: 200, t: "other" },
  { x: 0.48, y: 0.82, h: 250, t: "cargo" },  { x: 0.56, y: 0.78, h: 280, t: "tanker" },
  { x: 0.62, y: 0.70, h: 300, t: "cargo" },  { x: 0.66, y: 0.62, h: 320, t: "other" },
  { x: 0.70, y: 0.54, h: 340, t: "cargo" },  { x: 0.74, y: 0.46, h: 10,  t: "tanker" },
  { x: 0.78, y: 0.60, h: 60,  t: "cargo" },  { x: 0.82, y: 0.70, h: 100, t: "other" },
  { x: 0.86, y: 0.78, h: 140, t: "cargo" },  { x: 0.50, y: 0.72, h: 240, t: "tanker" },
  { x: 0.44, y: 0.66, h: 260, t: "cargo" },  { x: 0.58, y: 0.60, h: 300, t: "other" },
  { x: 0.68, y: 0.40, h: 20,  t: "cargo" },  { x: 0.60, y: 0.34, h: 30,  t: "tanker" },
];
const VESSEL_TONE = { cargo: "#7ef0b4", tanker: "#ffb347", other: "#7dd3fc" } as const;

const RISK_COLORS = { normal: "#7ef0b4", congested: "#ffb347", severe: "#ff5566", lowconf: "#c58cff" } as const;

function RadarPage() {
  const severe = PORTS.filter(p => p.risk === "severe").length;
  const congested = PORTS.filter(p => p.risk === "congested").length;
  const meanCong = (PORTS.reduce((a, p) => a + p.congestion, 0) / PORTS.length) * 100;
  const vessels = PORTS.reduce((a, p) => a + p.vessels, 0);

  return (
    <div className="h-full flex flex-col">
      {/* Top: Map + Right rail */}
      <div className="flex-1 min-h-0 flex">
        {/* MAP */}
        <div className="flex-1 relative overflow-hidden border-r border-[var(--color-line)]">
          <MapCanvas />
          {/* Legend bar */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 px-4 py-1.5 border border-[var(--color-line)] bg-[oklch(0.10_0.02_240_/_0.85)] backdrop-blur text-[10px] tracking-widest">
            <span className="text-[var(--color-muted-foreground)]">LEGEND</span>
            <LegendDot color="#7ef0b4" label="Normal" />
            <LegendDot color="#ffb347" label="Congested" />
            <LegendDot color="#ff5566" label="Severe" />
            <LegendDot color="#c58cff" label="Low Confidence" />
            <span className="text-[var(--color-muted-foreground)]">✦ Major Port</span>
            <span className="text-[var(--color-muted-foreground)]">◆ Minor Port</span>
            <span className="text-[var(--color-muted-foreground)]">+ Vessel (Proxy)</span>
            <span className="text-[var(--color-muted-foreground)]">— Route</span>
            <span className="text-[var(--color-muted-foreground)]">● Chokepoint</span>
          </div>

          {/* Floating NLP intel — integrated glass panel */}
          <div className="absolute bottom-40 left-3 w-[300px] z-30 border border-[var(--color-cyan)]/25 bg-[oklch(0.10_0.02_240_/_0.72)] backdrop-blur-md shadow-[0_0_0_1px_oklch(0.82_0.18_195/0.08),0_8px_24px_-8px_oklch(0_0_0/0.6)]">
            <div className="flex items-center justify-between px-2 py-1 border-b border-[var(--color-cyan)]/20 bg-gradient-to-r from-[oklch(0.82_0.18_195/0.10)] to-transparent">
              <span className="text-[10px] tracking-[0.18em] text-[var(--color-cyan)] flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[var(--color-cyan)] animate-blink"/>NLP · NEWS INTELLIGENCE</span>
              <span className="text-[9px] tracking-widest text-[var(--color-muted-foreground)]">03:05 UTC</span>
            </div>
            <div className="p-2 space-y-1.5 max-h-[190px] overflow-auto">
              {NLP_HEADLINES.slice(0, 3).map((n, i) => (
                <div key={i} className="border-l-2 pl-2 py-0.5" style={{ borderColor: n.sev === "severe" ? "var(--color-red)" : "var(--color-amber)" }}>
                  <div className="flex items-center gap-1.5 text-[9px] text-[var(--color-muted-foreground)]">
                    <Chip tone={n.sev === "severe" ? "red" : "amber"}>{n.sev === "severe" ? "HIGH" : "MED"}</Chip>
                    <span>{n.tag} · Maritime</span>
                  </div>
                  <div className="text-[10px] text-[var(--color-foreground)] mt-0.5">{n.text}</div>
                  <div className="text-[9px] text-[var(--color-muted-foreground)] mt-0.5">AFFECTED PORTS <span className="text-[var(--color-foreground)]">JNPT, Mundra, Mumbai</span></div>
                </div>
              ))}
            </div>
          </div>

          {/* Model pipeline strip — integrated glass */}
          <div className="absolute bottom-3 right-3 w-[520px] z-30 border border-[var(--color-cyan)]/25 bg-[oklch(0.10_0.02_240_/_0.72)] backdrop-blur-md shadow-[0_0_0_1px_oklch(0.82_0.18_195/0.08),0_8px_24px_-8px_oklch(0_0_0/0.6)]">
            <div className="flex items-center justify-between px-2 py-1 border-b border-[var(--color-cyan)]/20 bg-gradient-to-r from-[oklch(0.82_0.18_195/0.10)] to-transparent">
              <span className="text-[10px] tracking-[0.18em] text-[var(--color-cyan)]">MODEL PIPELINE</span>
              <span className="text-[10px] text-[var(--color-mint)] flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[var(--color-mint)] animate-blink" />All systems operational</span>
            </div>
            <div className="flex items-stretch">
              {PIPELINE.map((s, i) => (
                <div key={s.key} className="flex-1 px-2 py-1.5 border-r border-[var(--color-line)] last:border-r-0 relative">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-7 h-7 rounded-sm border border-[var(--color-line-strong)] flex items-center justify-center text-[var(--color-cyan)] text-[10px]">◈</div>
                    <div className="text-[8px] tracking-widest text-[var(--color-muted-foreground)] text-center leading-tight">{s.name.split(" ").slice(0,2).join(" ")}</div>
                  </div>
                  {i < PIPELINE.length - 1 && (
                    <span className="absolute right-[-6px] top-1/2 -translate-y-1/2 text-[var(--color-line-strong)] text-[10px] z-10">▸</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT RAIL */}
        <aside className="w-[300px] shrink-0 bg-[oklch(0.11_0.02_240)] flex flex-col overflow-hidden">
          {/* National Stress Gauge */}
          <div className="border-b border-[var(--color-line)] p-3">
            <div className="label-xs mb-2">NATIONAL LOGISTICS STRESS</div>
            <div className="flex items-center gap-3">
              <StressGauge value={56} />
              <div className="flex flex-col text-[10px]">
                <span className="text-[var(--color-amber)] tracking-widest">ELEVATED</span>
                <span className="text-[var(--color-red)] mt-1">↑ 8 pts</span>
                <span className="text-[var(--color-muted-foreground)]">vs 24h ago</span>
                <Sparkline data={[42,45,48,50,49,52,54,56]} tone="red" height={20} />
              </div>
            </div>
          </div>

          {/* Top 5 Ports at Risk */}
          <div className="border-b border-[var(--color-line)] p-3">
            <div className="label-xs mb-2 flex justify-between">TOP 5 PORTS AT RISK <span className="text-[var(--color-cyan)] normal-case tracking-normal">See all</span></div>
            <div className="space-y-1.5">
              {[...PORTS].sort((a,b)=>b.congestion-a.congestion).slice(0,5).map((p,i)=>(
                <div key={p.code} className="grid grid-cols-[14px_1fr_32px_46px] items-center gap-2 text-[10px]">
                  <span className="text-[var(--color-muted-foreground)] tabular-nums">{i+1}.</span>
                  <span className="text-[var(--color-foreground)] truncate">{p.name}</span>
                  <span className="tabular-nums text-right text-[var(--color-foreground)]">{Math.round(p.congestion*100)}</span>
                  <Chip tone={p.risk==="severe"?"red":"amber"}>{p.risk==="severe"?"SEVERE":"HIGH"}</Chip>
                </div>
              ))}
            </div>
          </div>

          {/* Active alerts */}
          <div className="border-b border-[var(--color-line)] p-3 flex-1 min-h-0 overflow-auto">
            <div className="label-xs mb-2 flex justify-between">ACTIVE ALERTS <span className="text-[var(--color-cyan)] normal-case tracking-normal">See all (8)</span></div>
            <div className="space-y-1.5">
              {ALERTS.slice(0,5).map(a=>(
                <div key={a.id} className="grid grid-cols-[52px_1fr_40px] items-start gap-2 text-[10px]">
                  <Chip tone={a.sev==="severe"?"red":"amber"}>{a.sev==="severe"?"SEVERE":a.sev==="watch"?"MEDIUM":"HIGH"}</Chip>
                  <span className="text-[var(--color-foreground)] leading-snug">{a.text}</span>
                  <span className="tabular-nums text-right text-[var(--color-muted-foreground)]">{a.ts}</span>
                </div>
              ))}
              <div className="grid grid-cols-[52px_1fr_40px] items-start gap-2 text-[10px]">
                <Chip tone="cyan">INFO</Chip>
                <span className="text-[var(--color-foreground)] leading-snug">Cyclonic circulation in Bay of Bengal</span>
                <span className="tabular-nums text-right text-[var(--color-muted-foreground)]">03:05</span>
              </div>
            </div>
          </div>

          {/* AI Operator Summary */}
          <div className="p-3">
            <div className="label-xs mb-2 flex justify-between">AI OPERATOR SUMMARY <span className="text-[var(--color-muted-foreground)] normal-case tracking-normal">Updated: 03:12 UTC</span></div>
            <div className="text-[10px] leading-relaxed text-[var(--color-foreground)]">
              West coast congestion is critical with JNPT and Mundra severely impacted. Bab-el-Mandeb disruptions are increasing transit times. Bay of Bengal shows developing cyclonic activity; monitor Paradip and Vizag. Activate berth reallocation and review vessel nominations.
            </div>
            <div className="mt-2 text-[10px] text-[var(--color-cyan)]">View full analysis in Decision Room →</div>
          </div>
        </aside>
      </div>

      {/* Bottom metric strip */}
      <div className="h-[104px] shrink-0 border-t border-[var(--color-line)] grid grid-cols-5">
        <BottomStat n={severe} unit="" label="SEVERE PORTS" tone="red" sub={<span>↗ 2 vs 24h ago<br/><span className="text-[var(--color-foreground)]">JNPT · Mundra · Paradip · Chennai</span></span>} />
        <BottomStat n={congested} unit="" label="CONGESTED PORTS" tone="amber" sub={<span>↗ 1 vs 24h ago<br/><span className="text-[var(--color-foreground)]">Deendayal · Mumbai · Cochin · Vizag · Tuticorin · Kamarajar</span></span>} />
        <div className="border-r border-[var(--color-line)] px-4 py-3 flex flex-col gap-1">
          <div className="text-[36px] leading-none tabular-nums text-[var(--color-amber)] glow-amber">{meanCong.toFixed(1)}</div>
          <div className="text-[9px] tracking-widest text-[var(--color-muted-foreground)]">MEAN CONGESTION SCORE</div>
          <div className="mt-1"><Sparkline data={[45,48,50,52,49,51,54,56,53,55,56.2]} tone="amber" height={22}/></div>
          <div className="text-[9px] text-[var(--color-mint)]">↑ 6.8 vs 24h ago</div>
        </div>
        <BottomStat n={vessels} unit="" label="VESSELS IN FIELD" tone="cyan" sub={<span>↗ 9 vs 24h ago<br/><span className="text-[var(--color-foreground)]">Cargo 84 · Tanker 19 · Others 18</span></span>} />
        <div className="px-4 py-3 flex flex-col gap-1">
          <div className="text-[36px] leading-none tabular-nums text-[var(--color-purple)]">5</div>
          <div className="text-[9px] tracking-widest text-[var(--color-muted-foreground)]">WEATHER SYSTEMS TRACKED</div>
          <div className="text-[10px] text-[var(--color-foreground)] mt-1">1 Cyclone · 2 Depressions · 2 Systems</div>
          <div className="text-[9px] text-[var(--color-muted-foreground)]">Bay of Bengal · Arabian Sea</div>
        </div>
      </div>
    </div>
  );
}

function BottomStat({ n, unit, label, tone, sub }: { n: number; unit: string; label: string; tone: "red"|"amber"|"cyan"; sub: React.ReactNode }) {
  const c = tone === "red" ? "text-[var(--color-red)] glow-red" : tone === "amber" ? "text-[var(--color-amber)] glow-amber" : "text-[var(--color-cyan)] glow-cyan";
  return (
    <div className="border-r border-[var(--color-line)] px-4 py-3 flex flex-col gap-1">
      <div className={`text-[36px] leading-none tabular-nums ${c}`}>{n}{unit}</div>
      <div className="text-[9px] tracking-widest text-[var(--color-muted-foreground)]">{label}</div>
      <div className="text-[9px] text-[var(--color-muted-foreground)] leading-snug mt-1">{sub}</div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1.5 text-[var(--color-muted-foreground)]"><span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} /> {label}</span>;
}

function StressGauge({ value }: { value: number }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const pct = value / 100;
  return (
    <div className="relative w-[108px] h-[108px]">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <defs>
          <linearGradient id="stressG" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7ef0b4"/><stop offset="50%" stopColor="#ffb347"/><stop offset="100%" stopColor="#ff5566"/>
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r={r} fill="none" stroke="oklch(0.22 0.03 240)" strokeWidth="9" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="url(#stressG)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${c*pct} ${c}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[28px] leading-none tabular-nums text-[var(--color-foreground)]">{value}</div>
        <div className="text-[8px] tracking-widest text-[var(--color-muted-foreground)]">/100</div>
      </div>
    </div>
  );
}

function MapCanvas() {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 60); return () => clearInterval(id); }, []);

  return (
    <div className="absolute inset-0">
      <img src={indiaSat} alt="Satellite view of India" className="absolute inset-0 w-full h-full object-cover" style={{ filter: "brightness(0.75) contrast(1.05) saturate(0.9)" }} />
      {/* subtle wind streamline + precipitation overlay via SVG */}
      <svg viewBox="0 0 1000 700" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <radialGradient id="cyc" cx="70%" cy="72%" r="18%">
            <stop offset="0%" stopColor="oklch(0.68 0.24 25 / 0.65)"/>
            <stop offset="60%" stopColor="oklch(0.68 0.24 25 / 0.18)"/>
            <stop offset="100%" stopColor="oklch(0.68 0.24 25 / 0)"/>
          </radialGradient>
          <radialGradient id="rainCore" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="oklch(0.55 0.22 260 / 0.55)"/>
            <stop offset="60%" stopColor="oklch(0.60 0.18 200 / 0.28)"/>
            <stop offset="100%" stopColor="oklch(0.72 0.20 145 / 0)"/>
          </radialGradient>
          <linearGradient id="rainG" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="oklch(0.55 0.22 260 / 0.35)"/>
            <stop offset="1" stopColor="oklch(0.72 0.20 145 / 0.35)"/>
          </linearGradient>
          <filter id="softBlur"><feGaussianBlur stdDeviation="4"/></filter>
        </defs>
        {/* wind streamlines */}
        {Array.from({ length: 70 }).map((_, i) => {
          const y = 20 + (i * 9.5);
          const dx = ((tick + i * 3) % 200) - 100;
          const opacity = 0.14 + ((i * 7) % 10) / 55;
          const sw = 0.4 + ((i % 4) * 0.15);
          return (
            <path key={i}
              d={`M ${-50 + dx} ${y} Q 300 ${y - 30} 600 ${y + 20} T 1100 ${y}`}
              fill="none"
              stroke="oklch(0.82 0.18 195)"
              strokeWidth={sw}
              opacity={opacity} />
          );
        })}
        {/* precipitation blobs with soft cores */}
        <g filter="url(#softBlur)">
          <ellipse cx="700" cy="530" rx="150" ry="95" fill="url(#rainCore)" opacity="0.75" />
          <ellipse cx="200" cy="540" rx="115" ry="65" fill="url(#rainCore)" opacity="0.6" />
          <ellipse cx="420" cy="620" rx="90" ry="45" fill="url(#rainG)" opacity="0.35" />
        </g>
        {/* cyclone spiral */}
        <circle cx="720" cy="510" r="100" fill="url(#cyc)" />
        <g transform="translate(720 510)">
          <g style={{ transformOrigin: "0 0", animation: "sweep 10s linear infinite" }}>
            {[0, 45, 90, 135, 180, 225, 270, 315].map(a => (
              <path key={a} d="M 0 0 Q 26 -6 40 -22 Q 52 -34 60 -46" fill="none" stroke="oklch(0.68 0.24 25 / 0.65)" strokeWidth="1.1" transform={`rotate(${a})`} />
            ))}
          </g>
          <g style={{ transformOrigin: "0 0", animation: "sweep 16s linear infinite reverse" }}>
            {[0, 90, 180, 270].map(a => (
              <path key={a} d="M 0 0 Q 40 -12 70 -28" fill="none" stroke="oklch(0.68 0.24 25 / 0.32)" strokeWidth="0.6" transform={`rotate(${a})`} />
            ))}
          </g>
          <circle r="6" fill="none" stroke="var(--color-red)" strokeWidth="1" opacity="0.7" />
          <circle r="3" fill="var(--color-red)" />
          <text y="-16" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--color-red)" className="label-halo">CAT 6</text>
        </g>
      </svg>

      {/* Routes to chokepoints — layered glow + flowing dash */}
      <svg viewBox="0 0 1000 700" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
        {[
          ["INNSA", "HRMZ", "#7dd3fc"],
          ["INMUN", "SUEZ", "#7dd3fc"],
          ["INCOK", "BAB",  "#ffb347"],
          ["INMAA", "MLC",  "#ff5566"],
          ["INVTZ", "MLC",  "#ff5566"],
        ].map(([f, t, c], i) => {
          const from = PORT_POS[f as string];
          const to = CHOKES.find(x => x.code === t)!;
          if (!from) return null;
          const x1 = from.x * 1000, y1 = from.y * 700, x2 = to.x * 1000, y2 = to.y * 700;
          const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - 40;
          const d = `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
          return (
            <g key={i}>
              <path d={d} fill="none" stroke={c as string} strokeWidth="3" opacity="0.10" />
              <path d={d} fill="none" stroke={c as string} strokeWidth="1" strokeDasharray="4 6"
                style={{ animation: `dash-flow ${2.4 + i*0.3}s linear infinite` }} opacity="0.85" />
            </g>
          );
        })}
      </svg>


      {/* Vessel proxies — ship silhouettes with wake and motion track */}
      <svg viewBox="0 0 1000 700" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <filter id="vesselShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0.6" stdDeviation="0.6" floodColor="#000" floodOpacity="0.7"/>
          </filter>
        </defs>
        {VESSEL_PROXIES.map((v, i) => {
          const cx = v.x * 1000, cy = v.y * 700;
          const dur = 6 + (i % 5);
          return (
            <g key={i} transform={`translate(${cx} ${cy}) rotate(${v.h})`} style={{ animation: `vessel-drift ${dur}s ease-in-out infinite` }}>
              {/* wake */}
              <path d="M -18 0 Q -10 -2 -6 0 Q -10 2 -18 0 Z" fill={VESSEL_TONE[v.t]} opacity="0.18" />
              <line x1="-16" y1="0" x2="-6" y2="0" stroke={VESSEL_TONE[v.t]} strokeWidth="0.5" strokeDasharray="1.5 2" opacity="0.55" />
              {/* hull */}
              <path d="M -5 -1.6 L 3 -1.6 L 5.2 0 L 3 1.6 L -5 1.6 Z" fill={VESSEL_TONE[v.t]} stroke="#000" strokeWidth="0.35" opacity="0.98" filter="url(#vesselShadow)" />
              {/* superstructure */}
              <rect x="-2" y="-0.7" width="2.2" height="1.4" fill="#0a1420" opacity="0.7" />
            </g>
          );
        })}
      </svg>

      {/* Ports */}
      <div className="absolute inset-0">
        {PORTS.map(p => {
          const pos = PORT_POS[p.code];
          if (!pos) return null;
          const color = RISK_COLORS[p.risk];
          const size = 16 + p.congestion * 22;
          // Offset labels for dense west-coast cluster
          const dense = ["INMUN","INIXY","INBOM","INNSA"].includes(p.code);
          const labelOffset = p.code === "INMUN" ? { x: -70, y: -14 }
            : p.code === "INIXY" ? { x: -70, y: 2 }
            : p.code === "INBOM" ? { x: -78, y: -2 }
            : p.code === "INNSA" ? { x: -70, y: 14 }
            : { x: 10, y: -2 };
          const shortName = p.name.split(" / ")[0].split(" ")[0];
          return (
            <div key={p.code} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}>
              <div className="relative">
                {/* soft outer halo */}
                <span className="absolute rounded-full animate-halo" style={{ width: size*1.4, height: size*1.4, background: `radial-gradient(circle, ${color}30 0%, ${color}10 45%, transparent 70%)`, left: -size*0.7, top: -size*0.7, filter: "blur(1px)" }} />
                {/* mid pulse ring */}
                <span className="absolute rounded-full animate-pulse-ring" style={{ width: size, height: size, borderColor: `${color}90`, borderWidth: 1, borderStyle: "solid", left: -size/2, top: -size/2 }} />
                {/* inner ring */}
                <span className="absolute rounded-full" style={{ width: size * 0.5, height: size * 0.5, background: `${color}18`, border: `1px solid ${color}`, left: -size*0.25, top: -size*0.25 }} />
                {/* core dot */}
                <span className="block h-1.5 w-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}, 0 0 2px #fff` }} />
                {/* label — offset connector for dense cluster */}
                {dense && (
                  <svg className="absolute pointer-events-none" style={{ left: labelOffset.x + 60, top: labelOffset.y + 4, width: Math.abs(labelOffset.x)+4, height: 2, overflow: "visible" }}>
                    <line x1="0" y1="0" x2={-labelOffset.x - 4} y2="0" stroke={color} strokeWidth="0.6" opacity="0.6" />
                  </svg>
                )}
                <div className="absolute whitespace-nowrap" style={{ left: labelOffset.x, top: labelOffset.y }}>
                  <div className="text-[9px] font-semibold text-white leading-tight tracking-wide" style={{ textShadow: "0 0 3px #000, 0 1px 2px #000, 0 0 6px oklch(0.08 0.02 240)" }}>{shortName}</div>
                  <div className="text-[9px] tabular-nums leading-none font-semibold" style={{ color, textShadow: "0 0 3px #000, 0 0 2px #000" }}>{Math.round(p.congestion * 100)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>



      {/* Chokepoint callouts */}
      <div className="absolute inset-0">
        {CHOKES.map(c => {
          const border = c.tone === "red" ? "var(--color-red)" : c.tone === "amber" ? "var(--color-amber)" : "var(--color-mint)";
          const text = c.tone === "red" ? "text-[var(--color-red)]" : c.tone === "amber" ? "text-[var(--color-amber)]" : "text-[var(--color-mint)]";
          return (
            <div key={c.code} className="absolute" style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, transform: "translate(-50%,-50%)" }}>
              <div className="px-2 py-1 border bg-[oklch(0.10_0.02_240_/_0.85)] backdrop-blur text-[9px] tracking-widest" style={{ borderColor: border }}>
                <div className="text-[var(--color-foreground)] font-semibold">{c.label}</div>
                <div className={text}>{c.sub}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
