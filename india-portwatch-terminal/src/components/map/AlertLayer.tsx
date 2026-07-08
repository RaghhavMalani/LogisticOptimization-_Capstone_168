import L from "leaflet";
import { LayerGroup, Marker, Polyline, Tooltip } from "react-leaflet";
import type { PortOperationalSnapshot } from "@/services/portService";
import { asLatLng, colorForStatus } from "./mapUtils";

interface MapAlert {
  id: string;
  portCode: string;
  severity: string;
  text: string;
  ts: string;
}

function alertIcon(alert: MapAlert, color: string) {
  const label = alert.severity === "severe" ? "ALERT" : "WATCH";
  return L.divIcon({
    className: "pw-alert-leaflet-icon",
    html: `<span style="border-color:${color}; color:${color}">${label} ${alert.ts}</span>`,
    iconAnchor: [22, 8],
  });
}

export function AlertLayer({
  alerts,
  ports,
  visible,
}: {
  alerts: readonly MapAlert[];
  ports: PortOperationalSnapshot[];
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <LayerGroup>
      {alerts.slice(0, 6).map((alert, index) => {
        const port = ports.find((item) => item.code === alert.portCode);
        if (!port) return null;
        const color = colorForStatus(
          alert.severity === "severe" ? "severe" : "watch",
        );
        const portPoint = asLatLng(port.location);
        const labelPoint: [number, number] = [
          port.location.lat + (index % 2 === 0 ? 0.42 : -0.32),
          port.location.lon + (index % 3 === 0 ? 0.42 : -0.38),
        ];
        return (
          <LayerGroup key={alert.id}>
            <Polyline
              positions={[portPoint, labelPoint]}
              pathOptions={{
                color,
                opacity: 0.45,
                weight: 0.8,
                dashArray: "2 4",
              }}
            />
            <Marker position={labelPoint} icon={alertIcon(alert, color)}>
              <Tooltip className="pw-port-tooltip" direction="top">
                <div className="pw-tooltip-card">
                  <div className="text-[var(--color-cyan)]">{alert.id}</div>
                  <div>{port.name}</div>
                  <div>{alert.text}</div>
                </div>
              </Tooltip>
            </Marker>
          </LayerGroup>
        );
      })}
    </LayerGroup>
  );
}
