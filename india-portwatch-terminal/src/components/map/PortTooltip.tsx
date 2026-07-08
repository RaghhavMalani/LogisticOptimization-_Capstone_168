import { riskLabel } from "@/data/ports";
import type { PortOperationalSnapshot } from "@/services/portService";

export function PortTooltip({ port }: { port: PortOperationalSnapshot }) {
  return (
    <div className="pw-tooltip-card">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[var(--color-cyan)]">{port.code}</span>
        <span>{riskLabel[port.risk]}</span>
      </div>
      <div className="text-[var(--color-foreground)]">{port.name}</div>
      <div className="grid grid-cols-[72px_48px] gap-x-2 gap-y-0.5 tabular-nums">
        <span>CONG</span>
        <b>{Math.round(port.congestion * 100)}</b>
        <span>DELAY</span>
        <b>{port.delayHours.toFixed(1)}h</b>
        <span>VESSELS</span>
        <b>{port.vessels}</b>
        <span>CONF</span>
        <b>{Math.round(port.confidence * 100)}%</b>
      </div>
      <div className="text-[var(--color-muted-foreground)]">
        Click opens port cockpit
      </div>
    </div>
  );
}
