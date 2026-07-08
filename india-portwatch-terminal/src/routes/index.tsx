import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Chip, Sparkline } from "@/components/terminal/ui";
import indiaSat from "@/assets/india-satellite.jpg";
import { useEffect, useState } from "react";
import { AlertLayer } from "@/components/terminal/map/AlertLayer";
import { ChokepointRouteLayer } from "@/components/terminal/map/ChokepointRouteLayer";
import { PortRiskLayer } from "@/components/terminal/map/PortRiskLayer";
import { VesselProxyLayer } from "@/components/terminal/map/VesselProxyLayer";
import { WeatherOverlayLayer } from "@/components/terminal/map/WeatherOverlayLayer";
import { listAlertEvents, listNewsEvents } from "@/services/newsService";
import { listModelPipelineStatuses } from "@/services/modelService";
import { listChokepointRoutes, listChokepoints, listPortOperationalSnapshots } from "@/services/portService";
import { listVesselProxies } from "@/services/sarService";
import type { Chokepoint, ChokepointRoute, NewsEvent, VesselProxy } from "@/types/portwatch";
import type { PortOperationalSnapshot } from "@/services/portService";

export const Route = createFileRoute("/")({
  component: RadarPage,
});

function toHeadline(event: NewsEvent) {
  return {
    t: event.timestamp,
    src: event.source,
    tag: event.tag,
    sev: event.severity,
    text: event.text,
  };
}

function RadarPage() {
  const navigate = useNavigate();
  const ports = listPortOperationalSnapshots();
  const vesselProxies = listVesselProxies();
  const chokepoints = listChokepoints();
  const routes = listChokepointRoutes();
  const alerts = listAlertEvents();
  const headlines = listNewsEvents().map(toHeadline);
  const pipeline = listModelPipelineStatuses();
  const severe = ports.filter(p => p.risk === "severe").length;
  const congested = ports.filter(p => p.risk === "congested").length;
  const meanCong = (ports.reduce((a, p) => a + p.congestion, 0) / ports.length) * 100;
  const vessels = ports.reduce((a, p) => a + p.vessels, 0);
  const openPortCockpit = (portCode: string) => navigate({ to: "/port", search: { port: portCode } });

  return (
    <div className="h-full flex flex-col">
      {/* Top: Map + Right rail */}
      <div className="flex-1 min-h-0 flex">
        {/* MAP */}
        <div className="flex-1 relative overflow-hidden border-r border-[var(--color-line)]">
          <MapCanvas
            ports={ports}
            vessels={vesselProxies}
            chokepoints={chokepoints}
            routes={routes}
            alerts={alerts}
            onPortSelect={openPortCockpit}
          />
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
              {headlines.slice(0, 3).map((n, i) => (
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
              {pipeline.map((s, i) => (
                <div key={s.key} className="flex-1 px-2 py-1.5 border-r border-[var(--color-line)] last:border-r-0 relative">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-7 h-7 rounded-sm border border-[var(--color-line-strong)] flex items-center justify-center text-[var(--color-cyan)] text-[10px]">◈</div>
                    <div className="text-[8px] tracking-widest text-[var(--color-muted-foreground)] text-center leading-tight">{s.name.split(" ").slice(0,2).join(" ")}</div>
                  </div>
                  {i < pipeline.length - 1 && (
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
              {[...ports].sort((a,b)=>b.congestion-a.congestion).slice(0,5).map((p,i)=>(
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
              {alerts.slice(0,5).map(a=>(
                <div key={a.id} className="grid grid-cols-[52px_1fr_40px] items-start gap-2 text-[10px]">
                  <Chip tone={a.severity==="severe"?"red":"amber"}>{a.severity==="severe"?"SEVERE":a.severity==="watch"?"MEDIUM":"HIGH"}</Chip>
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

function MapCanvas({
  ports,
  vessels,
  chokepoints,
  routes,
  alerts,
  onPortSelect,
}: {
  ports: PortOperationalSnapshot[];
  vessels: VesselProxy[];
  chokepoints: Chokepoint[];
  routes: ChokepointRoute[];
  alerts: ReturnType<typeof listAlertEvents>;
  onPortSelect: (portCode: string) => void;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 60); return () => clearInterval(id); }, []);

  return (
    <div className="absolute inset-0">
      <img src={indiaSat} alt="Satellite view of India" className="absolute inset-0 w-full h-full object-cover" style={{ filter: "brightness(0.75) contrast(1.05) saturate(0.9)" }} />
      <WeatherOverlayLayer tick={tick} />
      <ChokepointRouteLayer ports={ports} chokepoints={chokepoints} routes={routes} />
      <VesselProxyLayer vessels={vessels} />
      <PortRiskLayer ports={ports} onPortSelect={onPortSelect} />
      <AlertLayer alerts={alerts} ports={ports} />
    </div>
  );
}
