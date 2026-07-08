import { riskColorHex } from "@/data/ports";
import type { PortOperationalSnapshot } from "@/services/portService";

export function PortRiskLayer({
  ports,
  onPortSelect,
}: {
  ports: PortOperationalSnapshot[];
  onPortSelect: (portCode: string) => void;
}) {
  return (
    <div className="absolute inset-0">
      {ports.map((port) => {
        const color = riskColorHex[port.risk];
        const size = 16 + port.congestion * 22;
        const dense = ["INMUN", "INIXY", "INBOM", "INNSA"].includes(port.code);
        const labelOffset =
          port.code === "INMUN"
            ? { x: -70, y: -14 }
            : port.code === "INIXY"
              ? { x: -70, y: 2 }
              : port.code === "INBOM"
                ? { x: -78, y: -2 }
                : port.code === "INNSA"
                  ? { x: -70, y: 14 }
                  : { x: 10, y: -2 };
        const shortName = port.name.split(" / ")[0].split(" ")[0];

        return (
          <button
            key={port.code}
            type="button"
            aria-label={`Open ${port.name} cockpit`}
            onClick={() => onPortSelect(port.code)}
            className="absolute -translate-x-1/2 -translate-y-1/2 text-left cursor-crosshair"
            style={{ left: `${port.radar.x * 100}%`, top: `${port.radar.y * 100}%` }}
          >
            <span className="relative block">
              <span
                className="absolute rounded-full animate-halo"
                style={{
                  width: size * 1.4,
                  height: size * 1.4,
                  background: `radial-gradient(circle, ${color}30 0%, ${color}10 45%, transparent 70%)`,
                  left: -size * 0.7,
                  top: -size * 0.7,
                  filter: "blur(1px)",
                }}
              />
              <span
                className="absolute rounded-full animate-pulse-ring"
                style={{ width: size, height: size, borderColor: `${color}90`, borderWidth: 1, borderStyle: "solid", left: -size / 2, top: -size / 2 }}
              />
              <span
                className="absolute rounded-full"
                style={{ width: size * 0.5, height: size * 0.5, background: `${color}18`, border: `1px solid ${color}`, left: -size * 0.25, top: -size * 0.25 }}
              />
              <span className="block h-1.5 w-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}, 0 0 2px #fff` }} />
              {dense && (
                <svg
                  className="absolute pointer-events-none"
                  style={{ left: labelOffset.x + 60, top: labelOffset.y + 4, width: Math.abs(labelOffset.x) + 4, height: 2, overflow: "visible" }}
                >
                  <line x1="0" y1="0" x2={-labelOffset.x - 4} y2="0" stroke={color} strokeWidth="0.6" opacity="0.6" />
                </svg>
              )}
              <span className="absolute whitespace-nowrap" style={{ left: labelOffset.x, top: labelOffset.y }}>
                <span
                  className="block text-[9px] font-semibold text-white leading-tight tracking-wide"
                  style={{ textShadow: "0 0 3px #000, 0 1px 2px #000, 0 0 6px oklch(0.08 0.02 240)" }}
                >
                  {shortName}
                </span>
                <span className="block text-[9px] tabular-nums leading-none font-semibold" style={{ color, textShadow: "0 0 3px #000, 0 0 2px #000" }}>
                  {Math.round(port.congestion * 100)}
                </span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
