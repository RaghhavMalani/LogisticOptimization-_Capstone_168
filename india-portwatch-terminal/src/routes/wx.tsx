import { createFileRoute } from "@tanstack/react-router";
import { Panel, Metric, Chip, Bar, Sparkline } from "@/components/terminal/ui";

export const Route = createFileRoute("/wx")({
  component: WxPage,
});

function WxPage() {
  return (
    <div className="h-full grid grid-cols-1 grid-rows-[auto_1fr_auto] gap-2">
      <div className="grid grid-cols-7 gap-2">
        <Metric label="WIND"           value="28"   unit="kt SW" tone="amber" sub="gust 41 kt" />
        <Metric label="WAVE HT"        value="2.6"  unit="m"     tone="amber" sub="period 8.2s" />
        <Metric label="PRECIP RATE"    value="14"   unit="mm/h"  tone="cyan"  sub="6h acc 62mm" />
        <Metric label="VISIBILITY"     value="8.2"  unit="km"    tone="mint"  sub="ceiling 900m" />
        <Metric label="CYC/STORM RISK" value="34"   unit="%"     tone="amber" sub="T+72h" />
        <Metric label="WX IMPACT"      value="0.71" tone="red"   sub="port ops" />
        <Metric label="WX PERSISTENCE" value="0.62" tone="amber" sub="regime 18h" />
      </div>

      <div className="min-h-0 grid grid-cols-[1.4fr_1fr] grid-rows-2 gap-2">
        <Panel title="WIND FIELD · MSL · +12H" className="row-span-2">
          <div className="relative w-full h-full bg-[var(--color-sea)] grid-bg overflow-hidden">
            <svg viewBox="0 0 600 500" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full">
              <defs>
                <radialGradient id="lp" cx="60%" cy="55%" r="45%">
                  <stop offset="0%" stopColor="oklch(0.68 0.24 25 / 0.3)"/>
                  <stop offset="100%" stopColor="oklch(0.68 0.24 25 / 0)"/>
                </radialGradient>
              </defs>
              <rect width="600" height="500" fill="url(#lp)" />
              {/* wind arrows grid */}
              {Array.from({length:12}).flatMap((_,r)=>Array.from({length:14}).map((_,c)=>{
                const x = 20 + c*42, y = 20 + r*40;
                const speed = 8 + ((r*c*7)%22);
                const dir = ((r*17 + c*23) % 360);
                const color = speed>22?"oklch(0.68 0.24 25 / 0.9)":speed>14?"oklch(0.82 0.18 75 / 0.9)":"oklch(0.82 0.18 195 / 0.8)";
                return (
                  <g key={r+"-"+c} transform={`translate(${x} ${y}) rotate(${dir})`} stroke={color} strokeWidth="1" fill="none">
                    <line x1="-9" y1="0" x2="9" y2="0" />
                    <polyline points="5,-3 9,0 5,3" />
                  </g>
                );
              }))}
              {/* Cyclone eye */}
              <g transform="translate(360 275)" className="animate-sweep">
                <circle r="34" fill="none" stroke="oklch(0.68 0.24 25 / 0.7)" strokeWidth="1" />
                <path d="M 0 -34 Q 24 -20 20 4 Q 16 28 -8 24 Q -32 20 -28 -4 Q -24 -28 0 -34" fill="none" stroke="oklch(0.68 0.24 25 / 0.8)" strokeWidth="1.5" />
                <circle r="3" fill="var(--color-red)" />
              </g>
              <text x="405" y="275" fontSize="10" fill="var(--color-red)" fontFamily="var(--font-sans)">CYC "AMPHAN-II" T+72H</text>
            </svg>
          </div>
        </Panel>

        <Panel title="PRECIPITATION · 24H ACC">
          <div className="p-3">
            <div className="grid grid-cols-12 gap-[2px]">
              {Array.from({length:96}).map((_,i)=>{
                const v = Math.abs(Math.sin(i*0.3)+Math.cos(i*0.18))/2;
                return <div key={i} className="h-4" style={{ background: `oklch(0.82 0.18 195 / ${v})` }} />;
              })}
            </div>
            <div className="mt-2 flex justify-between text-[9px] text-[var(--color-muted-foreground)] tabular-nums"><span>0 mm</span><span>25 mm</span><span>50 mm</span><span>100+</span></div>
            <div className="mt-3 label-xs">6H FORECAST</div>
            <Sparkline data={[4,6,9,12,14,17,20,18,14,10,7,5]} tone="cyan" height={36} />
          </div>
        </Panel>

        <Panel title="WAVE HEIGHT + VIS">
          <div className="p-3 grid grid-cols-2 gap-3 text-[11px]">
            <div>
              <div className="label-xs mb-1">SIG WAVE HEIGHT (m)</div>
              <Sparkline data={[1.4,1.6,1.9,2.2,2.5,2.8,2.6,2.4,2.1,1.9]} tone="amber" height={44} />
            </div>
            <div>
              <div className="label-xs mb-1">VISIBILITY (km)</div>
              <Sparkline data={[10,9.6,9,8.5,8.2,8,8.4,9,9.4,10]} tone="mint" height={44} />
            </div>
            <div className="col-span-2">
              <div className="label-xs mb-1">SWELL DIRECTION · ROSE</div>
              <svg viewBox="0 0 200 90" className="w-full h-24">
                {["N","NE","E","SE","S","SW","W","NW"].map((d,i)=>{
                  const a = (i/8)*Math.PI*2 - Math.PI/2;
                  const len = [10,14,20,32,40,52,30,18][i];
                  return <g key={d}><line x1="100" y1="45" x2={100+Math.cos(a)*len} y2={45+Math.sin(a)*len} stroke="var(--color-amber)" strokeWidth="4" opacity="0.75" /><text x={100+Math.cos(a)*60} y={45+Math.sin(a)*60+3} fontSize="8" fill="var(--color-muted-foreground)" textAnchor="middle">{d}</text></g>;
                })}
              </svg>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Panel title="WEATHER SHOCK · MODEL INPUTS">
          <div className="p-3 space-y-2 text-[11px]">
            <Row k="weather_hsmm_input" v="0.71" tone="red" />
            <Row k="weather_tft_covariate" v="[0.44,0.62,0.71,0.68]" tone="amber" />
            <Row k="weather_shock" v="+0.31 σ" tone="red" />
            <Row k="weather_persistence" v="0.62" tone="amber" />
            <Row k="regime_prior" v="CONG_HIGH · 0.55" tone="amber" />
          </div>
        </Panel>
        <Panel title="OPERATIONAL MEANING">
          <div className="p-3 text-[11px] leading-relaxed">
            Wind + swell combination reduces safe pilotage window at Chennai/Ennore to <span className="text-[var(--color-amber)]">22:00–04:00Z</span>.
            Berthing throughput expected to drop <span className="text-[var(--color-red)]">−18%</span> for 48h. Recommend staging inbound VLCC arrivals and holding container calls beyond T+60h.
          </div>
        </Panel>
        <Panel title="ADVISORIES">
          <div className="p-3 space-y-1.5 text-[11px]">
            <Advisory sev="red"    t="IMD" text="Cyclogenesis prob 34% · centre 12.4N/88.1E · T+72h landfall Kakinada corridor" />
            <Advisory sev="amber"  t="INCOIS" text="Storm surge 1.6–2.2m expected north Andhra coast" />
            <Advisory sev="amber"  t="DGS" text="Small craft advisory Bay of Bengal 06:00–24:00Z" />
            <Advisory sev="mint"   t="Mumbai MET" text="West coast improving; monsoon trough receding" />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone: "cyan"|"amber"|"red"|"mint" }) {
  const map: Record<string,string> = { cyan:"var(--color-cyan)", amber:"var(--color-amber)", red:"var(--color-red)", mint:"var(--color-mint)" };
  return (
    <div className="flex items-center justify-between border-b border-[var(--color-line)]/60 pb-1">
      <span className="text-[var(--color-muted-foreground)] text-[10px] tracking-widest">{k}</span>
      <span className="tabular-nums" style={{ color: map[tone] }}>{v}</span>
    </div>
  );
}
function Advisory({ sev, t, text }: { sev: "red"|"amber"|"mint"; t: string; text: string }) {
  const border = sev==="red"?"var(--color-red)":sev==="amber"?"var(--color-amber)":"var(--color-mint)";
  return (
    <div className="border-l-2 pl-2" style={{ borderColor: border }}>
      <div className="flex items-center gap-1 text-[9px] tracking-widest text-[var(--color-muted-foreground)]">
        <Chip tone={sev}>{sev.toUpperCase()}</Chip><span>{t}</span>
      </div>
      <div className="text-[var(--color-foreground)] text-[10px]">{text}</div>
    </div>
  );
}
