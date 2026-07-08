import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Panel, Chip, Bar, Metric } from "@/components/terminal/ui";
import { cn } from "@/lib/utils";
import { countFleetAtRisk, listFleetVessels } from "@/services/fleetService";
import { getPortSnapshot } from "@/services/portService";

export const Route = createFileRoute("/fleet")({
  component: FleetPage,
});

function FleetPage() {
  const fleet = listFleetVessels();
  const [sel, setSel] = useState(fleet[0].imo);
  const v = fleet.find(f=>f.imo===sel) ?? fleet[0];
  const port = getPortSnapshot(v.destinationPortCode);

  return (
    <div className="h-full grid grid-cols-1 grid-rows-[auto_1fr] gap-2">
      <div className="grid grid-cols-6 gap-2">
        <Metric label="FLEET SIZE"      value={fleet.length}                        tone="cyan"  sub="8 vessels tracked" />
        <Metric label="AT RISK"         value={countFleetAtRisk()} tone="red"  sub="wait risk > 0.6" />
        <Metric label="AVG BUFFER"      value="+17h"                                tone="mint"  sub="mean advisory" />
        <Metric label="AVG WAIT"        value="14.2h"                               tone="amber" sub="destination Q" />
        <Metric label="AVG CONFIDENCE"  value="0.83"                                tone="cyan"  sub="model agreement" />
        <Metric label="ADVISORIES"      value="6"                                   tone="amber" sub="today" />
      </div>

      <div className="min-h-0 grid grid-cols-[1.5fr_1fr] gap-2">
        <Panel title="FLEET BOARD · AI SHIP MANAGER · LIVE">
          <div className="text-[10px]">
            <div className="grid grid-cols-[90px_1fr_46px_50px_60px_60px_60px_60px_60px_46px] px-2 py-1 border-b border-[var(--color-line)] label-xs sticky top-0 bg-[var(--color-panel)]">
              <span>IMO</span><span>VESSEL</span><span>TYPE</span><span>DEST</span>
              <span className="text-right">ETA</span><span className="text-right">WAIT</span><span className="text-right">ENTRY</span>
              <span className="text-right">BEST</span><span className="text-right">WORST</span><span className="text-right">BUF</span>
            </div>
            {fleet.map(f=>(
              <button key={f.imo} onClick={()=>setSel(f.imo)} className={cn(
                "w-full grid grid-cols-[90px_1fr_46px_50px_60px_60px_60px_60px_60px_46px] items-center px-2 py-1.5 border-b border-[var(--color-line)]/40 text-left",
                sel===f.imo ? "bg-[var(--color-cyan)]/10 border-l-2 border-l-[var(--color-cyan)]" : "hover:bg-[var(--color-panel-2)]/50"
              )}>
                <span className="tabular-nums text-[var(--color-muted-foreground)]">{f.imo}</span>
                <span className="text-[var(--color-foreground)] truncate">{f.name}</span>
                <Chip tone={f.vesselType==="TANKER"?"amber":f.vesselType==="LNG"?"purple":f.vesselType==="CONT"?"cyan":"mint"}>{f.vesselType}</Chip>
                <span className="text-[var(--color-cyan)]">{getPortSnapshot(f.destinationPortCode).short}</span>
                <span className="text-right tabular-nums text-[var(--color-foreground)]">{f.eta}</span>
                <span className={"text-right tabular-nums " + (f.waitRisk>0.7?"text-[var(--color-red)]":f.waitRisk>0.5?"text-[var(--color-amber)]":"text-[var(--color-mint)]")}>{f.waitRisk.toFixed(2)}</span>
                <span className={"text-right tabular-nums " + (f.entryRisk>0.6?"text-[var(--color-red)]":f.entryRisk>0.4?"text-[var(--color-amber)]":"text-[var(--color-mint)]")}>{f.entryRisk.toFixed(2)}</span>
                <span className="text-right tabular-nums text-[var(--color-mint)]">{f.bestArrival}</span>
                <span className="text-right tabular-nums text-[var(--color-red)]">{f.worstArrival}</span>
                <span className="text-right tabular-nums text-[var(--color-cyan)]">{f.buffer}</span>
              </button>
            ))}
          </div>
        </Panel>

        <div className="grid grid-rows-[auto_1fr_auto] gap-2 min-h-0">
          <Panel title={`SELECTED · ${v.name}`}>
            <div className="p-3 grid grid-cols-2 gap-2 text-[11px]">
              <div><div className="label-xs">IMO</div><div className="tabular-nums text-[var(--color-cyan)]">{v.imo}</div></div>
              <div><div className="label-xs">TYPE</div><div>{v.vesselType}</div></div>
              <div><div className="label-xs">DEST</div><div className="text-[var(--color-cyan)]">{port.name}</div></div>
              <div><div className="label-xs">ETA</div><div className="tabular-nums">{v.eta}</div></div>
              <div><div className="label-xs">WAIT RISK</div><Bar value={v.waitRisk} tone={v.waitRisk>0.7?"red":v.waitRisk>0.5?"amber":"mint"}/></div>
              <div><div className="label-xs">ENTRY RISK</div><Bar value={v.entryRisk} tone={v.entryRisk>0.6?"red":v.entryRisk>0.4?"amber":"mint"}/></div>
              <div><div className="label-xs">CONF</div><div className="tabular-nums text-[var(--color-cyan)]">{v.confidence.toFixed(2)}</div></div>
              <div><div className="label-xs">BUFFER</div><div className="tabular-nums text-[var(--color-mint)]">{v.buffer}</div></div>
            </div>
          </Panel>

          <Panel title="ARRIVAL WINDOW · 10 DAYS">
            <div className="p-3">
              <div className="grid grid-cols-10 gap-[3px]">
                {Array.from({length:10}).map((_,i)=>{
                  const r = [0.42,0.55,0.68,0.79,0.86,0.74,0.62,0.51,0.44,0.38][i];
                  const tone = r>0.75?"red":r>0.55?"amber":"mint";
                  const bg = tone==="red"?"var(--color-red)":tone==="amber"?"var(--color-amber)":"var(--color-mint)";
                  return (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div className="text-[9px] text-[var(--color-muted-foreground)]">T+{i+1}</div>
                      <div className="h-14 w-full rounded-sm" style={{ background: `linear-gradient(180deg, ${bg} 0%, oklch(0.14 0.02 240) 100%)`, opacity: 0.85 }}/>
                      <div className="text-[10px] tabular-nums" style={{ color: bg }}>{(r*100).toFixed(0)}</div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[9px] text-[var(--color-muted-foreground)] mt-2"><span>BEST {v.bestArrival}</span><span>PEAK RISK T+5</span><span>WORST {v.worstArrival}</span></div>
            </div>
          </Panel>

          <Panel title="ADVISORY · AI SHIP MANAGER">
            <div className="p-3 text-[11px] leading-relaxed border-l-2 border-[var(--color-cyan)]">
              Hold current SOG and adjust ETA to <span className="text-[var(--color-mint)]">{v.bestArrival}</span> to avoid CONGESTED_HIGH regime at {port.name}. Expected berth wait drops from <span className="text-[var(--color-red)]">22h → 6h</span> with buffer <span className="text-[var(--color-cyan)]">{v.buffer}</span>. Fuel penalty ≈ <span className="text-[var(--color-amber)]">+2.4%</span>. Confidence <span className="text-[var(--color-cyan)]">{v.confidence.toFixed(2)}</span>.
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
