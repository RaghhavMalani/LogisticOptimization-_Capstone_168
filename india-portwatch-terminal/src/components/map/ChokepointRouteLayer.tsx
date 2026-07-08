import L from "leaflet";
import {
  CircleMarker,
  LayerGroup,
  Marker,
  Polyline,
  Tooltip,
} from "react-leaflet";
import type { PortOperationalSnapshot } from "@/services/portService";
import type { Chokepoint, ChokepointRoute } from "@/types/portwatch";
import { arcLatLng, asLatLng, colorForStatus } from "./mapUtils";

function chokepointLabel(chokepoint: Chokepoint, color: string) {
  return L.divIcon({
    className: "pw-chokepoint-label-icon",
    html: `<b>${chokepoint.name}</b><span style="color:${color}">${chokepoint.status.toUpperCase()}</span>`,
    iconAnchor: [-10, 8],
  });
}

export function ChokepointRouteLayer({
  ports,
  chokepoints,
  routes,
  visible,
}: {
  ports: PortOperationalSnapshot[];
  chokepoints: Chokepoint[];
  routes: ChokepointRoute[];
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <LayerGroup>
      {routes.map((route) => {
        const port = ports.find((item) => item.code === route.fromPortCode);
        const chokepoint = chokepoints.find(
          (item) => item.code === route.toChokepointCode,
        );
        if (!port || !chokepoint) return null;
        const color = colorForStatus(route.risk);
        return (
          <Polyline
            key={route.label}
            positions={arcLatLng(port.location, chokepoint.location)}
            pathOptions={{ color, opacity: 0.7, weight: 1.4, dashArray: "5 6" }}
          >
            <Tooltip className="pw-port-tooltip">
              <div className="pw-tooltip-card">
                <div className="text-[var(--color-cyan)]">{route.label}</div>
                <div>
                  {port.name} to {chokepoint.name}
                </div>
                <div>Transit status {route.risk.toUpperCase()}</div>
              </div>
            </Tooltip>
          </Polyline>
        );
      })}
      {chokepoints.map((chokepoint) => {
        const color = colorForStatus(chokepoint.status);
        const center = asLatLng(chokepoint.location);
        return (
          <LayerGroup key={chokepoint.code}>
            <CircleMarker
              center={center}
              radius={7}
              pathOptions={{
                color: "#edf7ff",
                fillColor: color,
                fillOpacity: 0.78,
                opacity: 0.9,
                weight: 1,
              }}
            >
              <Tooltip className="pw-port-tooltip">
                <div className="pw-tooltip-card">
                  <div className="text-[var(--color-cyan)]">
                    {chokepoint.code}
                  </div>
                  <div>{chokepoint.name}</div>
                  <div>Status {chokepoint.status.toUpperCase()}</div>
                </div>
              </Tooltip>
            </CircleMarker>
            <Marker
              position={center}
              icon={chokepointLabel(chokepoint, color)}
              interactive={false}
            />
          </LayerGroup>
        );
      })}
    </LayerGroup>
  );
}
