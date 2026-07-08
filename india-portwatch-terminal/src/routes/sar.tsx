import { createFileRoute } from "@tanstack/react-router";
import { Panel, Metric, Chip, Bar } from "@/components/terminal/ui";

export const Route = createFileRoute("/sar")({
  component: SarPage,
});

function SarPage() {
  return (
    <div className="h-full grid grid-cols-1 grid-rows-[auto_1fr] gap-2">
      <div className="grid grid-cols-6 gap-2">
        <Metric label="SCENE"          value="S1A_IW_20261108T003411" tone="cyan" sub="Sentinel-1A · GRD" />
        <Metric label="VESSEL DETECT." value="63" tone="mint" sub="Δ vs prev +14" />
        <Metric label="ANCHORAGE"      value="22" tone="amber" sub="ring 0 · 8" />
        <Metric label="CHANGE SCORE"   value="0.42" tone="amber" sub="vs T-1" />
        <Metric label="SAR CONFIDENCE" value="0.79" tone="cyan" sub="cloud N/A" />
        <Metric label="AIS FALLBACK"   value="ARMED" tone="mint" sub="17 vessels" />
      </div>

      <div className="min-h-0 grid grid-cols-[1fr_300px] gap-2">
        <Panel title="SAR PROXY · CHENNAI · S1A IW · VV+VH · GEE MODE">
          <div className="relative w-full h-full bg-[oklch(0.10_0.02_240)] overflow-hidden">
            {/* SAR raster look */}
            <div className="absolute inset-0" style={{
              backgroundImage: `
                radial-gradient(circle at 30% 45%, oklch(0.35 0.05 220 / 0.7) 0%, transparent 25%),
                radial-gradient(circle at 70% 30%, oklch(0.30 0.04 220 / 0.6) 0%, transparent 30%),
                radial-gradient(circle at 55% 70%, oklch(0.25 0.03 220 / 0.5) 0%, transparent 35%),
                repeating-linear-gradient(0deg, oklch(0.14 0.02 240) 0px, oklch(0.14 0.02 240) 1px, oklch(0.18 0.03 240 / 0.6) 1px, oklch(0.18 0.03 240 / 0.6) 2px),
                repeating-linear-gradient(90deg, oklch(0.14 0.02 240) 0px, oklch(0.14 0.02 240) 1px, oklch(0.16 0.03 240 / 0.4) 1px, oklch(0.16 0.03 240 / 0.4) 2px)
              `
            }} />
            <svg viewBox="0 0 1000 620" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full">
              {/* Coastline */}
              <path d="M 0 80 Q 200 60 380 120 Q 520 180 620 240 Q 720 300 820 380 L 1000 420 L 1000 0 L 0 0 Z" fill="oklch(0.22 0.04 220 / 0.9)" stroke="oklch(0.82 0.18 195 / 0.6)" strokeWidth="1" />
              {/* Anchorage rings */}
              <g transform="translate(500 380)" fill="none" stroke="oklch(0.82 0.18 75 / 0.7)">
                <circle r="90" strokeDasharray="4 4" />
                <circle r="150" strokeDasharray="2 6" />
                <text x="0" y="-96" textAnchor="middle" fontSize="9" fill="var(--color-amber)">ANCHORAGE Q · 22</text>
              </g>
              {/* Bright vessel detections */}
              {Array.from({length:63}).map((_,i)=>{
                const cx = 200 + ((i*137)%700);
                const cy = 200 + ((i*89)%380);
                return (
                  <g key={i}>
                    <circle cx={cx} cy={cy} r="4" fill="oklch(0.98 0.05 200)" opacity="0.85" />
                    <circle cx={cx} cy={cy} r="8" fill="none" stroke="oklch(0.82 0.18 195 / 0.5)" strokeWidth="0.5" />
                  </g>
                );
              })}
              {/* Queue zone highlight */}
              <rect x="380" y="300" width="240" height="180" fill="oklch(0.82 0.18 75 / 0.05)" stroke="oklch(0.82 0.18 75 / 0.5)" strokeDasharray="3 4" />
              <text x="390" y="315" fontSize="9" fill="var(--color-amber)">QUEUE ZONE · CH-A</text>

              {/* Reticles */}
              {[[40,40],[960,40],[40,580],[960,580]].map(([x,y],i)=>(
                <g key={i} stroke="var(--color-cyan)" strokeWidth="0.8" opacity="0.6"><line x1={x-10} y1={y} x2={x+10} y2={y}/><line x1={x} y1={y-10} x2={x} y2={y+10}/></g>
              ))}
            </svg>
            <div className="absolute top-2 left-2 text-[9px] tracking-widest text-[var(--color-cyan)] bg-[var(--color-background)]/70 border border-[var(--color-line)] px-2 py-1">SENTINEL-1A · IW · 10m · VV+VH · 20261108T003411Z</div>
            <div className="absolute bottom-2 right-2 text-[9px] tracking-widest text-[var(--color-muted-foreground)] bg-[var(--color-background)]/70 border border-[var(--color-line)] px-2 py-1">GEE · SAR-PROXY · ESA COPERNICUS</div>
          </div>
        </Panel>

        <div className="flex flex-col gap-2 min-h-0">
          <Panel title="DETECTIONS · SUMMARY">
            <div className="p-3 space-y-2 text-[11px]">
              <div className="flex justify-between"><span className="text-[var(--color-muted-foreground)]">CONT</span><span className="tabular-nums text-[var(--color-cyan)]">24</span></div>
              <div className="flex justify-between"><span className="text-[var(--color-muted-foreground)]">TANKER</span><span className="tabular-nums text-[var(--color-amber)]">18</span></div>
              <div className="flex justify-between"><span className="text-[var(--color-muted-foreground)]">BULK</span><span className="tabular-nums text-[var(--color-mint)]">15</span></div>
              <div className="flex justify-between"><span className="text-[var(--color-muted-foreground)]">UNCLASSIFIED</span><span className="tabular-nums text-[var(--color-purple)]">6</span></div>
              <div className="border-t border-[var(--color-line)] pt-2 label-xs">CHANGE vs T-1</div>
              <Bar value={0.42} tone="amber" />
              <div className="text-[10px] text-[var(--color-muted-foreground)]">+14 vessels · queue expansion detected NE quadrant</div>
            </div>
          </Panel>
          <Panel title="AIS FALLBACK · GAP FILL">
            <div className="p-3 text-[11px] space-y-1.5">
              <div className="flex justify-between"><span>AIS ACTIVE</span><Chip tone="mint">46</Chip></div>
              <div className="flex justify-between"><span>SAR-ONLY</span><Chip tone="amber">17</Chip></div>
              <div className="flex justify-between"><span>DARK VESSELS</span><Chip tone="red">3</Chip></div>
              <div className="text-[10px] text-[var(--color-muted-foreground)] pt-2">Dark-vessel candidates flagged for enrichment via next Sentinel-2 pass (T+04:12h).</div>
            </div>
          </Panel>
          <Panel title="SAR / AIS FUSION SCORE" className="flex-1">
            <div className="p-3 space-y-2 text-[11px]">
              <div className="flex justify-between"><span>Cross-match rate</span><span className="tabular-nums text-[var(--color-mint)]">94%</span></div>
              <Bar value={0.94} tone="mint" />
              <div className="flex justify-between"><span>Bounding IoU</span><span className="tabular-nums text-[var(--color-cyan)]">0.81</span></div>
              <Bar value={0.81} tone="cyan" />
              <div className="flex justify-between"><span>Heading agreement</span><span className="tabular-nums text-[var(--color-cyan)]">0.86</span></div>
              <Bar value={0.86} tone="cyan" />
              <div className="text-[10px] text-[var(--color-muted-foreground)] pt-2">Fusion → HSMM proxy channel <span className="text-[var(--color-cyan)]">sar_ais_fused</span></div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
