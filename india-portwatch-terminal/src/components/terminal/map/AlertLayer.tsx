import { riskColorHex } from "@/data/ports";
import type { PortOperationalSnapshot } from "@/services/portService";

interface MapAlert {
  id: string;
  portCode: string;
  severity: string;
  text: string;
  ts: string;
}

export function AlertLayer({ alerts, ports }: { alerts: readonly MapAlert[]; ports: PortOperationalSnapshot[] }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {alerts.slice(0, 5).map((alert, index) => {
        const port = ports.find((item) => item.code === alert.portCode);
        if (!port) return null;
        const color = alert.severity === "severe" ? riskColorHex.severe : riskColorHex.congested;
        return (
          <div
            key={alert.id}
            className="absolute z-20"
            style={{
              left: `${port.radar.x * 100}%`,
              top: `${port.radar.y * 100}%`,
              transform: `translate(${index % 2 === 0 ? 10 : -74}px, ${index % 2 === 0 ? -30 : 18}px)`,
            }}
          >
            <div
              className="px-1.5 py-0.5 border bg-[oklch(0.10_0.02_240_/_0.78)] backdrop-blur text-[8px] tracking-widest max-w-[112px] truncate"
              style={{ borderColor: color, color }}
              title={alert.text}
            >
              {alert.severity === "severe" ? "ALERT" : "WATCH"} {alert.ts}
            </div>
          </div>
        );
      })}
    </div>
  );
}
