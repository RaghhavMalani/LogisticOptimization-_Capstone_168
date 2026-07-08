import type { Chokepoint, ChokepointRoute } from "@/types/portwatch";
import type { PortOperationalSnapshot } from "@/services/portService";

const routeColor = {
  normal: "#7ef0b4",
  watch: "#ffb347",
  elevated: "#ff5566",
  severe: "#ff5566",
} as const;

const toneText = {
  normal: "Transit: Normal",
  watch: "Transit: Congested",
  elevated: "Transit: Congested",
  severe: "Transit: Severe",
} as const;

export function ChokepointRouteLayer({
  ports,
  chokepoints,
  routes,
}: {
  ports: PortOperationalSnapshot[];
  chokepoints: Chokepoint[];
  routes: ChokepointRoute[];
}) {
  return (
    <>
      <svg viewBox="0 0 1000 700" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
        {routes.map((route, index) => {
          const from = ports.find((port) => port.code === route.fromPortCode);
          const to = chokepoints.find((choke) => choke.code === route.toChokepointCode);
          if (!from || !to) return null;
          const x1 = from.radar.x * 1000;
          const y1 = from.radar.y * 700;
          const x2 = to.radar.x * 1000;
          const y2 = to.radar.y * 700;
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2 - 40;
          const d = `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
          const color = routeColor[route.risk];
          return (
            <g key={route.label}>
              <path d={d} fill="none" stroke={color} strokeWidth="3" opacity="0.10" />
              <path
                d={d}
                fill="none"
                stroke={color}
                strokeWidth="1"
                strokeDasharray="4 6"
                style={{ animation: `dash-flow ${2.4 + index * 0.3}s linear infinite` }}
                opacity="0.85"
              />
            </g>
          );
        })}
      </svg>

      <div className="absolute inset-0 pointer-events-none">
        {chokepoints.map((choke) => {
          const status = choke.status;
          const border =
            status === "severe" ? "var(--color-red)" : status === "elevated" || status === "watch" ? "var(--color-amber)" : "var(--color-mint)";
          const text =
            status === "severe" ? "text-[var(--color-red)]" : status === "elevated" || status === "watch" ? "text-[var(--color-amber)]" : "text-[var(--color-mint)]";
          return (
            <div
              key={choke.code}
              className="absolute"
              style={{ left: `${choke.radar.x * 100}%`, top: `${choke.radar.y * 100}%`, transform: "translate(-50%,-50%)" }}
            >
              <div className="px-2 py-1 border bg-[oklch(0.10_0.02_240_/_0.85)] backdrop-blur text-[9px] tracking-widest" style={{ borderColor: border }}>
                <div className="text-[var(--color-foreground)] font-semibold">{choke.name}</div>
                <div className={text}>{toneText[status]}</div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
