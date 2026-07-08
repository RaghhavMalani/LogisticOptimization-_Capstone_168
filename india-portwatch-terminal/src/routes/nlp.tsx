import { createFileRoute } from "@tanstack/react-router";
import { Panel, Chip, Bar } from "@/components/terminal/ui";
import { NLP_HEADLINES } from "@/data/portwatch";

export const Route = createFileRoute("/nlp")({
  component: NlpPage,
});

const entities = [
  { e: "HORMUZ", n: 42, s: -0.42 },
  { e: "RED SEA", n: 31, s: -0.36 },
  { e: "CHENNAI", n: 24, s: -0.28 },
  { e: "MUMBAI", n: 19, s: -0.14 },
  { e: "MUNDRA", n: 12, s: +0.08 },
  { e: "SUEZ", n: 8, s: -0.06 },
  { e: "MALACCA", n: 6, s: +0.02 },
];

function NlpPage() {
  return (
    <div className="h-full grid grid-cols-[1.4fr_1fr_1fr] gap-2">
      <Panel title="NLP FEED · GDELT + REUTERS + LLOYD'S · Δ 45s">
        <div className="p-2 space-y-2">
          {NLP_HEADLINES.concat(NLP_HEADLINES).map((n,i)=>(
            <div key={i} className="panel p-2">
              <div className="flex items-center justify-between text-[9px] tracking-widest text-[var(--color-muted-foreground)]">
                <div className="flex items-center gap-2">
                  <span className="tabular-nums">{n.t}Z</span>
                  <Chip tone={n.sev==="severe"?"red":n.sev==="elevated"?"amber":"amber"}>{n.tag}</Chip>
                  <span>{n.src}</span>
                </div>
                <span>SENT {(Math.random()*-0.6).toFixed(2)}</span>
              </div>
              <div className="text-[11px] text-[var(--color-foreground)] leading-snug mt-1">{n.text}</div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid grid-rows-2 gap-2 min-h-0">
        <Panel title="ENTITY SALIENCE">
          <div className="p-3 space-y-1.5 text-[11px]">
            {entities.map(e=>(
              <div key={e.e} className="grid grid-cols-[80px_1fr_46px] items-center gap-2">
                <span className="text-[var(--color-cyan)]">{e.e}</span>
                <Bar value={e.n/50} tone={e.s<-0.2?"red":e.s<0?"amber":"mint"} />
                <span className={"text-right tabular-nums " + (e.s<-0.2?"text-[var(--color-red)]":e.s<0?"text-[var(--color-amber)]":"text-[var(--color-mint)]")}>{e.s>=0?"+":""}{e.s.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="SUPPLY-CHAIN GRAPH">
          <div className="p-3">
            <svg viewBox="0 0 400 220" className="w-full h-full">
              {[
                {id:"HRMZ",x:60,y:60,c:"red"},{id:"BAB",x:60,y:160,c:"amber"},
                {id:"SUEZ",x:200,y:40,c:"amber"},{id:"MLC",x:340,y:60,c:"mint"},
                {id:"IN-W",x:200,y:120,c:"amber"},{id:"IN-E",x:340,y:160,c:"red"},
              ].map(n=>(
                <g key={n.id} transform={`translate(${n.x} ${n.y})`}>
                  <circle r="14" fill="oklch(0.18 0.03 240)" stroke={`var(--color-${n.c})`} strokeWidth="1.5"/>
                  <text textAnchor="middle" y="3" fontSize="9" fill={`var(--color-${n.c})`}>{n.id}</text>
                </g>
              ))}
              {[["HRMZ","IN-W"],["BAB","IN-W"],["SUEZ","IN-W"],["MLC","IN-E"],["IN-W","IN-E"]].map(([a,b],i)=>{
                const nodes: any = {HRMZ:[60,60],BAB:[60,160],SUEZ:[200,40],MLC:[340,60],"IN-W":[200,120],"IN-E":[340,160]};
                const [x1,y1]=nodes[a], [x2,y2]=nodes[b];
                return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="oklch(0.82 0.18 195 / 0.4)" strokeWidth="1" className="animate-dash"/>;
              })}
            </svg>
          </div>
        </Panel>
      </div>

      <div className="grid grid-rows-[auto_1fr_auto] gap-2 min-h-0">
        <Panel title="SENTIMENT TIMELINE · 24H">
          <div className="p-3">
            <svg viewBox="0 0 240 80" className="w-full h-24">
              <line x1="0" y1="40" x2="240" y2="40" stroke="var(--color-line-strong)" strokeDasharray="2 3"/>
              <polyline points={Array.from({length:24}).map((_,i)=>`${i*10},${40-Math.sin(i/2)*15-((i>16)?10:0)}`).join(" ")} fill="none" stroke="var(--color-red)" strokeWidth="1.4"/>
            </svg>
            <div className="flex justify-between text-[9px] text-[var(--color-muted-foreground)] tabular-nums"><span>-24h</span><span>NOW</span></div>
          </div>
        </Panel>
        <Panel title="LLM INTELLIGENCE · SUMMARY">
          <div className="p-3 text-[11px] leading-relaxed space-y-2">
            <p>Corpus of <span className="text-[var(--color-cyan)] tabular-nums">1,284</span> maritime articles in last 24h. Dominant themes: <span className="text-[var(--color-red)]">Hormuz tanker rerouting</span>, <span className="text-[var(--color-amber)]">Bay-of-Bengal cyclogenesis</span>, <span className="text-[var(--color-amber)]">JNPT congestion</span>.</p>
            <p>Sentiment on India east-coast ports has decayed <span className="text-[var(--color-red)]">−0.24</span> over 12h. GDELT tone reinforces HSMM regime shift to CONGESTED_HIGH.</p>
            <p>NLP feeds forward with weight <span className="text-[var(--color-cyan)] tabular-nums">0.18</span> into TFT covariates.</p>
          </div>
        </Panel>
        <Panel title="KEYWORD PULSE">
          <div className="p-3 flex flex-wrap gap-1.5 text-[10px]">
            {["strait of hormuz","tanker premium","cyclogenesis","kakinada","dredging","labour rotation","monsoon swell","reroute","cape of good hope","fuel surcharge","JNPT","yard util"].map(k=>(
              <span key={k} className="border border-[var(--color-line-strong)] px-1.5 py-0.5 text-[var(--color-muted-foreground)]">{k}</span>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
