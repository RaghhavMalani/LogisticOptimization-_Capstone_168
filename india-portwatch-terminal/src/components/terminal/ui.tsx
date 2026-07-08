import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({ title, right, children, className, bodyClassName }: {
  title?: string; right?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string;
}) {
  return (
    <div className={cn("panel flex flex-col overflow-hidden", className)}>
      {title && (
        <div className="panel-header">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-cyan)] animate-blink" />
            {title}
          </span>
          {right && <span className="text-[9px] tracking-widest text-[var(--color-muted-foreground)]">{right}</span>}
        </div>
      )}
      <div className={cn("flex-1 min-h-0 overflow-auto", bodyClassName)}>{children}</div>
    </div>
  );
}

export function Metric({ label, value, unit, tone = "cyan", sub }: {
  label: string; value: string | number; unit?: string; tone?: "cyan"|"mint"|"amber"|"red"|"purple"|"muted"; sub?: ReactNode;
}) {
  const toneCls: Record<string,string> = {
    cyan: "text-[var(--color-cyan)]",
    mint: "text-[var(--color-mint)]",
    amber: "text-[var(--color-amber)]",
    red: "text-[var(--color-red)] glow-red",
    purple: "text-[var(--color-purple)]",
    muted: "text-[var(--color-muted-foreground)]",
  };
  return (
    <div className="panel px-3 py-2 flex flex-col gap-0.5">
      <div className="label-xs">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className={cn("num-lg tabular-nums", toneCls[tone])}>{value}</span>
        {unit && <span className="text-[10px] text-[var(--color-muted-foreground)]">{unit}</span>}
      </div>
      {sub && <div className="text-[10px] text-[var(--color-muted-foreground)]">{sub}</div>}
    </div>
  );
}

export function Chip({ tone = "muted", children }: { tone?: "cyan"|"mint"|"amber"|"red"|"purple"|"muted"; children: ReactNode }) {
  const map: Record<string,string> = {
    cyan:   "border-[var(--color-cyan)]/50 text-[var(--color-cyan)] bg-[var(--color-cyan)]/5",
    mint:   "border-[var(--color-mint)]/40 text-[var(--color-mint)] bg-[var(--color-mint)]/5",
    amber:  "border-[var(--color-amber)]/50 text-[var(--color-amber)] bg-[var(--color-amber)]/5",
    red:    "border-[var(--color-red)]/60 text-[var(--color-red)] bg-[var(--color-red)]/10",
    purple: "border-[var(--color-purple)]/50 text-[var(--color-purple)] bg-[var(--color-purple)]/10",
    muted:  "border-[var(--color-line-strong)] text-[var(--color-muted-foreground)]",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 border px-1.5 py-[1px] rounded-sm text-[9px] tracking-widest uppercase font-semibold", map[tone])}>
      {children}
    </span>
  );
}

export function Bar({ value, tone = "cyan" }: { value: number; tone?: "cyan"|"mint"|"amber"|"red" }) {
  const color: Record<string,string> = {
    cyan: "bg-[var(--color-cyan)]",
    mint: "bg-[var(--color-mint)]",
    amber: "bg-[var(--color-amber)]",
    red: "bg-[var(--color-red)]",
  };
  return (
    <div className="h-1 w-full rounded-sm bg-[var(--color-panel-2)] overflow-hidden">
      <div className={cn("h-full", color[tone])} style={{ width: `${Math.min(100, Math.max(0, value*100))}%` }} />
    </div>
  );
}

export function Sparkline({ data, tone = "cyan", height = 24 }: { data: number[]; tone?: "cyan"|"mint"|"amber"|"red"; height?: number }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const w = 100, h = height;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / (max - min || 1)) * (h - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const color: Record<string,string> = {
    cyan: "var(--color-cyan)", mint: "var(--color-mint)", amber: "var(--color-amber)", red: "var(--color-red)",
  };
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <polyline points={pts} fill="none" stroke={color[tone]} strokeWidth={1.2} />
    </svg>
  );
}
