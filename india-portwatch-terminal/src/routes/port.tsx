import { createFileRoute } from "@tanstack/react-router";
import { Chip, Sparkline, Bar } from "@/components/terminal/ui";
import { NLP_HEADLINES, PORTS } from "@/data/portwatch";
import chennaiSat from "@/assets/chennai-port.jpg";

export const Route = createFileRoute("/port")({
  component: PortPage,
});

const berthOcc = [
  ["B1", 100, "red"], ["B2", 95, "red"], ["B3", 95, "red"], ["B4", 90, "red"],
  ["B5", 65, "amber"], ["B6", 60, "amber"], ["B7", 60, "amber"], ["B8", 50, "amber"],
  ["B9", 40, "mint"], ["B10", 30, "mint"],
] as const;

const forecastDays = [
  { d: 1, delay: 76.8, band: 12.6, wxPct: 93, sev: "SEVERE" },
  { d: 2, delay: 78.5, band: 12.0, wxPct: 91, sev: "SEVERE" },
  { d: 3, delay: 71.3, band: 9.4,  wxPct: 85, sev: "HIGH" },
  { d: 4, delay: 62.1, band: 7.1,  wxPct: 75, sev: "HIGH" },
  { d: 5, delay: 53.2, band: 5.8,  wxPct: 0,  sev: "MOD" },
  { d: 6, delay: 48.7, band: 4.6,  wxPct: 0,  sev: "MOD" },
  { d: 7, delay: 46.6, band: 4.2,  wxPct: 0,  sev: "MOD" },
  { d: 8, delay: 44.3, band: 3.9,  wxPct: 0,  sev: "MOD" },
  { d: 9, delay: 40.8, band: 3.3,  wxPct: 0,  sev: "LOW" },
  { d: 10, delay: 39.1, band: 3.0, wxPct: 0,  sev: "LOW" },
];

const experts = [
  ["Weather Expert",   "Monsoon conditions impacting pilotage & yard ops.",   0.93, "cyan"],
  ["News / Geo Expert","Labor risk moderate; export demand surge ongoing.",   0.88, "amber"],
  ["Port Ops Expert",  "Berth occupancy high; yard dwell increasing.",         0.90, "amber"],
  ["Demand Expert",    "Auto components & projects cargo demand high.",        0.86, "cyan"],
  ["HSMM Regime",      "Severe regime likely to persist in short term.",       0.93, "red"],
  ["TFT Forecast",     "Congestion index forecast for next 10 days.",          0.91, "red"],
] as const;

function PortPage() {
  const chn = PORTS.find(p => p.code === "INMAA")!;

  return (
    <div className="h-full overflow-auto">
      <div className="min-h-full p-3 space-y-3">
        {/* PAGE HEADER */}
        <div className="grid grid-cols-[1.4fr_1fr_0.9fr_1fr_1fr_1.1fr_1.1fr] gap-2 items-stretch">
          <div className="panel px-4 py-3 col-span-1">
            <div className="text-[9px] tracking-[0.24em] text-[var(--color-muted-foreground)]">PORT OPERATIONS COCKPIT FOR</div>
            <div className="text-[32px] leading-none tracking-[0.06em] text-[var(--color-foreground)] font-semibold">CHENNAI</div>
            <div className="text-[9px] tracking-[0.24em] text-[var(--color-muted-foreground)] mt-1">CHENNAI PORT AUTHORITY</div>
          </div>
          <HdrField label="CURRENT PORT AUTHORITY" value="Chennai Port Authority" sub="13.0827° N, 80.2707° E" />
          <HdrField label="CURRENT REGIME" chip={<Chip tone="red">SEVERE</Chip>} />
          <HdrField label="FORECAST ORIGIN" value="07 MAY 2025" sub="03:00 UTC" />
          <HdrField label="MODEL CONFIDENCE" chip={<Chip tone="mint">HIGH</Chip>} sub="93%" />
          <HdrField label="SELECT PORT" value="CHENNAI ▾" />
          <HdrField label="LAST UPDATED" value="07 May 2025 06:15 UTC" chip={<Chip tone="mint">● LIVE</Chip>} />
        </div>

        {/* TOP KPI STRIP */}
        <div className="grid grid-cols-7 gap-2">
          <Kpi label="SEVERITY" big="SEVERE" tone="red" sub="HIGH IMPACT" />
          <Kpi label="CHENNAI PORT CONGESTION" big="76.8" tone="red" sub="Index (0-100)" spark={[45,50,58,64,68,72,75,76.8]} sparkTone="red" />
          <Kpi label="PEAK DELAY (P95)" big="12.6 h" tone="red" sub="(next 24h)" spark={[8,9,10,11,12,12.4,12.6]} sparkTone="red" />
          <Kpi label="THROUGHPUT (27D)" big="42,318" tone="cyan" sub="TEU" spark={[38000,39500,40100,41000,41800,42100,42318]} sparkTone="cyan" />
          <Kpi label="TRANSITION RISK" big="63%" tone="amber" sub="(12h Horizon)" spark={[42,48,54,58,60,62,63]} sparkTone="amber" />
          <Kpi label="CONFIDENCE" big="93%" tone="mint" sub="Model Confidence" spark={[85,88,90,91,92,93,93]} sparkTone="mint" />
          <div className="panel px-3 py-2 flex flex-col justify-between">
            <div>
              <div className="label-xs">RECOMMENDATION (CHENNAI)</div>
              <div className="mt-1 text-[11px] text-[var(--color-foreground)] leading-snug">
                <span className="text-[var(--color-amber)]">Activate congestion protocol.</span> Prioritize berth allocation. Stagger arrivals. Advise vessels to slow steam.
              </div>
            </div>
            <button className="mt-1 self-end text-[var(--color-cyan)] text-[16px]">›</button>
          </div>
        </div>

        {/* AI OPERATIONAL BRIEFING STRIP */}
        <div className="panel px-3 py-2 flex items-center gap-4 text-[11px]">
          <span className="text-[var(--color-cyan)] flex items-center gap-2 whitespace-nowrap"><span className="h-1.5 w-1.5 rounded-full bg-[var(--color-cyan)] animate-blink"/>AI OPERATIONAL BRIEFING</span>
          <span className="text-[var(--color-foreground)] flex-1">
            Chennai Port congestion is severe. Peak congestion on Day 1–2 (Δ+12.6h). High onshore wind and moderate sea state may impact pilotage and cargo ops.
          </span>
          <div className="flex items-center gap-3 text-[10px] text-[var(--color-mint)]">
            <span>● Activate congestion protocol</span>
            <span>● Prioritize berth allocation</span>
            <span>● Stagger arrivals</span>
            <span>● Advise vessels to slow steam</span>
          </div>
          <span className="text-[9px] text-[var(--color-muted-foreground)]">Generated by India PortWatch AI · 07 May 2025 06:15 UTC</span>
        </div>

        {/* MID GRID: twin | hsmm | weather */}
        <div className="grid grid-cols-[1.6fr_0.9fr_1.1fr] gap-2" style={{ minHeight: 380 }}>
          {/* DIGITAL TWIN */}
          <div className="panel flex flex-col">
            <div className="panel-header"><span>PORT DIGITAL TWIN — CHENNAI PORT</span><span>UPDATED: 06:15 UTC</span></div>
            <div className="relative flex-1 overflow-hidden">
              <img src={chennaiSat} alt="Chennai port satellite" className="absolute inset-0 w-full h-full object-cover" style={{ filter: "brightness(0.72) saturate(1.08) contrast(1.05)" }} />
              <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at center, transparent 40%, oklch(0 0 0 / 0.55) 100%)" }} />

              {/* Zone shading + labels + vessels */}
              <svg viewBox="0 0 800 500" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                <defs>
                  <linearGradient id="berthZone" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="oklch(0.86 0.19 155 / 0.10)"/>
                    <stop offset="1" stopColor="oklch(0.86 0.19 155 / 0.02)"/>
                  </linearGradient>
                  <linearGradient id="anchorZone" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="oklch(0.82 0.18 75 / 0.14)"/>
                    <stop offset="1" stopColor="oklch(0.82 0.18 75 / 0.02)"/>
                  </linearGradient>
                  <radialGradient id="harborZone" cx="30%" cy="55%" r="45%">
                    <stop offset="0" stopColor="oklch(0.82 0.18 195 / 0.14)"/>
                    <stop offset="100%" stopColor="oklch(0.82 0.18 195 / 0)"/>
                  </radialGradient>
                  <filter id="vShip" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="0.5" stdDeviation="0.5" floodColor="#000" floodOpacity="0.65"/>
                  </filter>
                </defs>

                {/* Zone regions */}
                <path d="M 40 140 Q 250 130 320 200 L 320 420 Q 200 440 40 420 Z" fill="url(#harborZone)" stroke="oklch(0.82 0.18 195 / 0.35)" strokeWidth="0.8" strokeDasharray="3 4" />
                <path d="M 200 160 L 340 160 L 340 400 L 200 400 Z" fill="url(#berthZone)" stroke="oklch(0.86 0.19 155 / 0.4)" strokeWidth="0.6" strokeDasharray="2 3" />
                <path d="M 380 100 Q 620 130 780 220 L 780 460 Q 600 470 380 460 Z" fill="url(#anchorZone)" stroke="oklch(0.82 0.18 75 / 0.35)" strokeWidth="0.6" strokeDasharray="2 4" />

                {/* Zone captions */}
                <text x="60" y="128" fontSize="8" letterSpacing="2" fill="oklch(0.82 0.18 195)" opacity="0.85" className="label-halo">◆ INNER HARBOUR</text>
                <text x="216" y="152" fontSize="8" letterSpacing="2" fill="oklch(0.86 0.19 155)" opacity="0.9" className="label-halo">◆ BERTH AREA</text>
                <text x="560" y="94" fontSize="8" letterSpacing="2" fill="oklch(0.82 0.18 75)" opacity="0.9" className="label-halo">◆ OUTER ANCHORAGE</text>

                {/* Berth region sub-labels */}
                {[
                  ["KASIMEDU HARBOUR", 90, 40], ["KASIRAJPURAM", 210, 30], ["ENNORE", 480, 30],
                  ["PORT TRUST", 90, 90], ["BHARATI DOCK", 130, 180], ["NORTH HARBOUR", 100, 240],
                  ["CENTRAL BASIN", 180, 300], ["OIL JETTY", 220, 380], ["SOUTH HARBOUR", 130, 420],
                  ["KAMARAJAR PORT LTD (KPL)", 210, 470],
                ].map(([t, x, y]) => (
                  <text key={t as string} x={x as number} y={y as number} fontSize="8" fill="oklch(0.82 0.18 195)" opacity="0.55" letterSpacing="1.2" className="label-halo">{t}</text>
                ))}

                {/* Berth quay line */}
                <line x1="205" y1="170" x2="205" y2="395" stroke="oklch(0.86 0.19 155 / 0.6)" strokeWidth="0.8" />

                {/* Vessels at berth — ship silhouettes with wake */}
                {Array.from({ length: 22 }).map((_, i) => {
                  const x = 216 + i * 5.5;
                  const y = 180 + Math.sin(i * 0.9) * 4 + (i % 3) * 22;
                  const c = i % 5 === 0 ? "#ff5566" : i % 3 === 0 ? "#ffb347" : i % 4 === 0 ? "#c58cff" : "#7ef0b4";
                  const r = 90 + ((i * 37) % 20) - 10;
                  return (
                    <g key={"b"+i} transform={`translate(${x} ${y}) rotate(${r})`} style={{ animation: `vessel-drift ${4 + (i%4)}s ease-in-out infinite` }}>
                      <path d="M -6 -1.8 L 3.5 -1.8 L 6 0 L 3.5 1.8 L -6 1.8 Z" fill={c} opacity="0.98" stroke="#000" strokeWidth="0.35" filter="url(#vShip)" />
                      <rect x="-2.6" y="-0.7" width="2.2" height="1.4" fill="#0a1420" opacity="0.75" />
                    </g>
                  );
                })}
                {/* Anchored vessels — smaller ships in outer roads */}
                {Array.from({ length: 26 }).map((_, i) => {
                  const angle = (i / 26) * Math.PI * 1.1 - 0.4;
                  const r = 200 + (i % 4) * 26;
                  const x = 500 + Math.cos(angle) * r;
                  const y = 260 + Math.sin(angle) * r * 0.55;
                  const c = i % 6 === 0 ? "#ffb347" : "#7dd3fc";
                  const rot = (i*47)%360;
                  return (
                    <g key={"a"+i} transform={`translate(${x} ${y}) rotate(${rot})`} style={{ animation: `vessel-drift ${5 + (i%5)}s ease-in-out infinite` }}>
                      <line x1="-14" y1="0" x2="-6" y2="0" stroke={c} strokeWidth="0.4" strokeDasharray="1.4 2" opacity="0.5" />
                      <path d="M -5 -1.5 L 3 -1.5 L 5 0 L 3 1.5 L -5 1.5 Z" fill={c} opacity="0.94" stroke="#000" strokeWidth="0.3" filter="url(#vShip)" />
                    </g>
                  );
                })}
                {/* Approach lanes with glow */}
                <path d="M 800 220 Q 600 260 380 300" stroke="oklch(0.82 0.18 195)" strokeWidth="3" opacity="0.10" fill="none" />
                <path d="M 800 220 Q 600 260 380 300" stroke="oklch(0.82 0.18 195 / 0.85)" strokeWidth="1.1" strokeDasharray="4 5" fill="none" style={{ animation: "dash-flow 3s linear infinite" }} />
                <path d="M 800 380 Q 620 380 440 400" stroke="oklch(0.82 0.18 75)" strokeWidth="3" opacity="0.08" fill="none" />
                <path d="M 800 380 Q 620 380 440 400" stroke="oklch(0.82 0.18 75 / 0.8)" strokeWidth="1.1" strokeDasharray="4 5" fill="none" style={{ animation: "dash-flow 4s linear infinite" }} />
                <path d="M 780 140 Q 620 190 440 240" stroke="oklch(0.82 0.18 195 / 0.5)" strokeWidth="0.9" strokeDasharray="2 5" fill="none" />
              </svg>


              {/* Legend */}
              <div className="absolute bottom-2 left-2 right-2 px-2 py-1 border border-[var(--color-cyan)]/25 bg-[oklch(0.10_0.02_240_/_0.82)] backdrop-blur flex items-center gap-3 text-[9px] tracking-widest">
                <LegendPill c="#7ef0b4" t="At Berth"/><LegendPill c="#ffb347" t="Anchored"/><LegendPill c="#7dd3fc" t="En Route"/><LegendPill c="#c58cff" t="Drifting"/><LegendPill c="#ff5566" t="Restricted"/>
                <span className="ml-auto flex items-center gap-3"><span className="text-[var(--color-muted-foreground)]">-·- Tug/Service</span><span className="text-[var(--color-muted-foreground)]">---- Approach Lane</span></span>
              </div>
            </div>
          </div>

          {/* Anchorage + Berth Occupancy */}
          <div className="panel flex flex-col">
            <div className="panel-header"><span>ANCHORAGE QUEUES</span></div>
            <div className="p-3 space-y-2 text-[11px]">
              {[
                ["Outer Anchorage (E)", 25, "#7ef0b4"], ["Outer Anchorage (W)", 17, "#ffb347"],
                ["Northern Roads", 10, "#7dd3fc"], ["Southern Roads", 10, "#c58cff"],
              ].map(([l, n, c]) => (
                <div key={l as string} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[var(--color-foreground)]"><span className="h-2 w-2 rounded-full" style={{ background: c as string }} />{l}</span>
                  <span className="tabular-nums text-[var(--color-muted-foreground)]">{n} vessels</span>
                </div>
              ))}
            </div>
            <div className="panel-header border-t border-[var(--color-line)]"><span>BERTH OCCUPANCY</span></div>
            <div className="p-2 space-y-1 text-[10px]">
              {berthOcc.map(([b, v, tone]) => (
                <div key={b} className="grid grid-cols-[24px_1fr_36px] items-center gap-2">
                  <span className="text-[var(--color-cyan)]">{b}</span>
                  <div className="h-1.5 bg-[var(--color-panel-2)] overflow-hidden rounded-sm">
                    <div className="h-full" style={{ width: `${v}%`, background: tone === "red" ? "var(--color-red)" : tone === "amber" ? "var(--color-amber)" : "var(--color-mint)" }} />
                  </div>
                  <span className="tabular-nums text-right text-[var(--color-foreground)]">{v}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* HSMM + weather column */}
          <div className="grid grid-rows-2 gap-2">
            <div className="panel">
              <div className="panel-header"><span>HSMM REGIME INTELLIGENCE (CHENNAI)</span></div>
              <div className="p-3 space-y-2 text-[11px]">
                {[["Normal",0,"mint"],["Congested",7,"amber"],["Severe",91,"red"]].map(([l,v,t])=>(
                  <div key={l as string}>
                    <div className="flex justify-between mb-1"><span className="text-[var(--color-foreground)]">{l}</span><span className={t==="red"?"text-[var(--color-red)]":t==="amber"?"text-[var(--color-amber)]":"text-[var(--color-mint)]"}>{v}%</span></div>
                    <div className="h-1 bg-[var(--color-panel-2)]"><div className="h-full" style={{ width: `${v}%`, background: t==="red"?"var(--color-red)":t==="amber"?"var(--color-amber)":"var(--color-mint)"}} /></div>
                  </div>
                ))}
                <div className="pt-2 border-t border-[var(--color-line)] space-y-1 text-[10px]">
                  <Row k="Days in State" v="3.2" />
                  <Row k="Expected remaining" v="1.3 day" />
                  <Row k="Transition risk (24h)" v={<><span className="text-[var(--color-foreground)]">63%</span> <Chip tone="red">HIGH</Chip></>} />
                  <Row k="State confidence" v={<><span className="text-[var(--color-foreground)]">93%</span> <Chip tone="red">HIGH</Chip></>} />
                </div>
              </div>
            </div>
            <div className="panel">
              <div className="panel-header"><span>WEATHER INTELLIGENCE · CHENNAI COASTAL OUTLOOK</span></div>
              <div className="p-3 grid grid-cols-3 gap-x-3 gap-y-2 text-[10px]">
                <WxCell l="WIND (10m)" v="28 kt" sub="WNW" />
                <WxCell l="GUSTS" v="38 kt" />
                <WxCell l="RAINFALL (24h)" v="18 mm" />
                <WxCell l="WAVE HEIGHT" v="1.7 m" sub="S" />
                <WxCell l="SEA STATE" v="Moderate" />
                <WxCell l="VISIBILITY" v="9 km" sub="Good" tone="mint" />
                <div className="col-span-3 mt-1 border-t border-[var(--color-line)] pt-2">
                  <div className="label-xs mb-1">MONSOON OUTLOOK</div>
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div><div className="text-[var(--color-muted-foreground)]">SW Monsoon</div><div className="text-[var(--color-mint)]">Active</div></div>
                    <div><div className="text-[var(--color-muted-foreground)]">Cyclone Risk (7D)</div><div className="text-[var(--color-mint)]">Low</div></div>
                    <div><div className="text-[var(--color-muted-foreground)]">Next Tide</div><div className="text-[var(--color-foreground)]">07:42</div></div>
                  </div>
                </div>
                <div className="col-span-3 mt-1 border-t border-[var(--color-line)] pt-2">
                  <div className="label-xs mb-1">WEATHER MODULE OUTPUTS</div>
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <WxOut k="weather_raw_score" v="0.68" />
                    <WxOut k="weather_impact_score" v="0.72" />
                    <WxOut k="weather_persistence" v="SW_MONSOON_ACTIVE" tone="mint" />
                    <WxOut k="weather_shock" v="0.19" />
                    <WxOut k="weather_hsmm_input" v="0.71" tone="red" />
                    <WxOut k="weather_tft_covariate" v="0.67" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 10-DAY FORECAST TIMELINE */}
        <div className="panel">
          <div className="panel-header"><span>10-DAY FORECAST TIMELINE · CHENNAI PORT</span></div>
          <div className="p-2 grid grid-cols-10 gap-1.5">
            {forecastDays.map((d, i) => {
              const tone = d.sev === "SEVERE" ? "red" : d.sev === "HIGH" ? "amber" : d.sev === "MOD" ? "cyan" : "mint";
              const bg = tone === "red" ? "var(--color-red)" : tone === "amber" ? "var(--color-amber)" : tone === "cyan" ? "var(--color-cyan)" : "var(--color-mint)";
              return (
                <div key={i} className="panel p-2 flex flex-col gap-1" style={{ animation: `fade-in .5s ease-out ${i*60}ms both` }}>
                  <div className="flex justify-between items-center text-[9px]"><span className="text-[var(--color-muted-foreground)]">DAY {d.d} · {String(6+i).padStart(2,"0")} MAY</span><span className="px-1 border" style={{ borderColor: bg, color: bg }}>{d.sev}</span></div>
                  <div className="text-[16px] tabular-nums text-[var(--color-foreground)] leading-none">{d.delay}</div>
                  <div className="text-[9px] text-[var(--color-muted-foreground)]">(±{d.band}h)</div>
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="text-[var(--color-cyan)]">☁</span>
                    {d.wxPct > 0 && <span className="text-[var(--color-red)] tabular-nums">{d.wxPct}%</span>}
                  </div>
                  <div className="h-0.5" style={{ background: bg, opacity: 0.7 }} />
                </div>
              );
            })}
          </div>
        </div>

        {/* BOTTOM: DRIVERS · EXPERT CHAIN · NEWS */}
        <div className="grid grid-cols-3 gap-2">
          <div className="panel">
            <div className="panel-header"><span>KEY FORECAST DRIVERS · CHENNAI</span><span>IMPACT</span></div>
            <div className="p-2 space-y-1.5 text-[11px]">
              {[["1","Wind Speed (WNW 20–30 kt)","+28%","HIGH","red"],
                ["2","SW Monsoon Onset (Active)","+25%","HIGH","red"],
                ["3","Sea State (Moderate)","+16%","HIGH","amber"],
                ["4","Labor Availability Risk","+11%","MED","amber"],
                ["5","Dredging Operations (Entry Channel)","-7%","LOW","mint"],
                ["6","Export Demand (Auto Components)","+6%","MED","amber"]].map(([n,label,delta,sev,tone])=>(
                <div key={n} className="grid grid-cols-[16px_1fr_50px_54px] items-center gap-2">
                  <span className="text-[var(--color-cyan)] tabular-nums">{n}</span>
                  <span className="text-[var(--color-foreground)]">{label}</span>
                  <span className="text-right tabular-nums text-[var(--color-foreground)]">{delta}</span>
                  <Chip tone={tone as any}>{sev}</Chip>
                </div>
              ))}
              <div className="text-[9px] text-[var(--color-muted-foreground)] pt-1 border-t border-[var(--color-line)]/60">ⓘ Impact shown is relative contribution to congestion index (next 24h).</div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><span>MODEL OUTPUTS · EXPERT CHAIN (CHENNAI)</span><span>Confidence</span></div>
            <div className="p-2 space-y-1.5 text-[11px]">
              {experts.map(([name, note, conf, tone]) => (
                <div key={name as string} className="grid grid-cols-[18px_140px_1fr_36px] gap-2 items-center">
                  <span className="text-[var(--color-cyan)]">◎</span>
                  <span className="text-[var(--color-foreground)]">{name}</span>
                  <span className="text-[10px] text-[var(--color-muted-foreground)]">{note}</span>
                  <span className={"text-right tabular-nums " + (tone === "red" ? "text-[var(--color-red)]" : tone === "amber" ? "text-[var(--color-amber)]" : "text-[var(--color-cyan)]")}>{(conf as number).toFixed(2)}</span>
                </div>
              ))}
              <div className="text-[9px] text-[var(--color-muted-foreground)] pt-1 border-t border-[var(--color-line)]/60">ⓘ Expert chain output drives HSMM regime and TFT forecast.</div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><span>NEWS INTELLIGENCE · THIS PORT (CHENNAI)</span><span>Impact · Confidence</span></div>
            <div className="p-2 space-y-2 text-[11px]">
              {[
                ["1","Labor Risk","HIGH","red","Union strike notice issued by CITU at Chennai Port from 10 May","(Ops may slow if unresolved)","High","0.87"],
                ["2","Export Demand Surge","HIGH","red","Surge in auto components exports via Chennai","(BMW, Hyundai, Ford shipments)","High","0.90"],
                ["3","Berth Operations","MEDIUM","amber","Berths B3 & B4 maintenance works on 12–13 May","(Partial closure expected)","Medium","0.76"],
                ["4","Dredging Update","LOW","mint","Maintenance dredging in south channel 09–15 May","(Improves draft post works)","Low","0.65"],
              ].map(([n,cat,sev,tone,title,paren,imp,conf])=>(
                <div key={n as string} className="grid grid-cols-[14px_1fr_54px_44px] gap-2">
                  <span className="text-[var(--color-cyan)] tabular-nums">{n}</span>
                  <div>
                    <div className="flex items-center gap-2"><span className="text-[var(--color-foreground)] font-medium">{cat}</span><Chip tone={tone as any}>{sev}</Chip></div>
                    <div className="text-[10px] text-[var(--color-foreground)]">{title}</div>
                    <div className="text-[9px] text-[var(--color-muted-foreground)]">{paren}</div>
                  </div>
                  <span className="text-right text-[10px] text-[var(--color-foreground)] self-start">{imp}</span>
                  <span className="text-right tabular-nums text-[10px] text-[var(--color-cyan)] self-start">{conf}</span>
                </div>
              ))}
              <div className="text-[9px] text-[var(--color-muted-foreground)] pt-1 border-t border-[var(--color-line)]/60">ⓘ News & events intelligence integrated into expert chain.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HdrField({ label, value, sub, chip }: { label: string; value?: string; sub?: string; chip?: React.ReactNode }) {
  return (
    <div className="panel px-3 py-2 flex flex-col justify-center min-h-[68px]">
      <div className="text-[9px] tracking-[0.2em] text-[var(--color-muted-foreground)]">{label}</div>
      {chip ? <div className="mt-1">{chip}</div> : value && <div className="text-[12px] text-[var(--color-foreground)] mt-0.5">{value}</div>}
      {sub && <div className="text-[9px] text-[var(--color-muted-foreground)] mt-0.5">{sub}</div>}
    </div>
  );
}

function Kpi({ label, big, tone, sub, spark, sparkTone }: { label: string; big: string; tone: "red"|"amber"|"cyan"|"mint"; sub?: string; spark?: number[]; sparkTone?: "red"|"amber"|"cyan"|"mint" }) {
  const c = tone === "red" ? "text-[var(--color-red)] glow-red" : tone === "amber" ? "text-[var(--color-amber)] glow-amber" : tone === "cyan" ? "text-[var(--color-cyan)]" : "text-[var(--color-mint)]";
  const accent = tone === "red" ? "var(--color-red)" : tone === "amber" ? "var(--color-amber)" : tone === "cyan" ? "var(--color-cyan)" : "var(--color-mint)";
  return (
    <div className="panel relative px-3 py-2.5 flex flex-col gap-1.5 overflow-hidden">
      <span className="absolute left-0 top-0 bottom-0 w-[2px]" style={{ background: `linear-gradient(180deg, ${accent}, transparent)`, opacity: 0.8 }} />
      <div className="label-xs">{label}</div>
      <div className={`text-[22px] leading-none tabular-nums font-semibold ${c}`}>{big}</div>
      {sub && <div className="text-[9px] text-[var(--color-muted-foreground)]">{sub}</div>}
      {spark && <div className="-mx-1"><Sparkline data={spark} tone={sparkTone || "cyan"} height={20} /></div>}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex items-center justify-between border-b border-[var(--color-line)]/50 pb-1"><span className="text-[var(--color-muted-foreground)]">{k}</span><span className="flex items-center gap-1">{v}</span></div>;
}

function WxCell({ l, v, sub, tone }: { l: string; v: string; sub?: string; tone?: "mint"|"amber"|"red"|"cyan" }) {
  const c = tone === "mint" ? "text-[var(--color-mint)]" : tone === "amber" ? "text-[var(--color-amber)]" : tone === "red" ? "text-[var(--color-red)]" : "text-[var(--color-foreground)]";
  return (
    <div>
      <div className="text-[9px] tracking-widest text-[var(--color-muted-foreground)]">{l}</div>
      <div className={`text-[14px] tabular-nums ${c}`}>{v}</div>
      {sub && <div className="text-[9px] text-[var(--color-muted-foreground)]">{sub}</div>}
    </div>
  );
}

function WxOut({ k, v, tone }: { k: string; v: string; tone?: "mint"|"red" }) {
  const c = tone === "mint" ? "text-[var(--color-mint)]" : tone === "red" ? "text-[var(--color-red)]" : "text-[var(--color-foreground)]";
  return (
    <div>
      <div className="text-[9px] text-[var(--color-muted-foreground)]">{k}</div>
      <div className={`text-[11px] tabular-nums ${c}`}>{v}</div>
    </div>
  );
}

function LegendPill({ c, t }: { c: string; t: string }) {
  return <span className="flex items-center gap-1 text-[var(--color-muted-foreground)]"><span className="h-1.5 w-1.5 rounded-full" style={{ background: c, boxShadow: `0 0 4px ${c}` }} />{t}</span>;
}
