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
import { arcLatLng, asLatLng, colorForStatus } from "@/components/map/mapUtils";

function pulseIcon(color: string) {
  return L.divIcon({
    className: "pw-route-pulse-icon",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<span style="--route-color:${color}"></span>`,
  });
}

function chokepointLabel(chokepoint: Chokepoint, color: string) {
  return L.divIcon({
    className: "pw-radar-chokepoint-callout",
    iconAnchor: [-8, 16],
    html: `<b>${chokepoint.name}</b><span style="color:${color}">${chokepoint.status.toUpperCase()}</span>`,
  });
}

export function RoutePulseLayer({
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
      {routes.map((route, index) => {
        const port = ports.find((item) => item.code === route.fromPortCode);
        const chokepoint = chokepoints.find(
          (item) => item.code === route.toChokepointCode,
        );
        if (!port || !chokepoint) return null;
        const color = colorForStatus(route.risk);
        const arc = arcLatLng(port.location, chokepoint.location, 64);
        const pulsePoint =
          arc[
            Math.min(
              arc.length - 1,
              Math.floor(arc.length * (0.42 + (index % 3) * 0.12)),
            )
          ];

        return (
          <LayerGroup key={route.label}>
            <Polyline
              positions={arc}
              pathOptions={{
                color,
                opacity: 0.12,
                weight: 6,
                className: "pw-route-glow-line",
              }}
              interactive={false}
            />
            <Polyline
              positions={arc}
              pathOptions={{
                color,
                opacity: 0.74,
                weight: 1.4,
                dashArray: "2 8",
                className: "pw-route-dash-line",
              }}
            >
              <Tooltip className="pw-port-tooltip">
                <div className="pw-tooltip-card">
                  <div className="text-[var(--color-cyan)]">{route.label}</div>
                  <div>{port.name}</div>
                  <div>
                    {chokepoint.name} · {route.risk.toUpperCase()}
                  </div>
                </div>
              </Tooltip>
            </Polyline>
            <Marker
              position={pulsePoint}
              icon={pulseIcon(color)}
              interactive={false}
            />
          </LayerGroup>
        );
      })}
      {chokepoints.map((chokepoint) => {
        const color = colorForStatus(chokepoint.status);
        const center = asLatLng(chokepoint.location);
        return (
          <LayerGroup key={chokepoint.code}>
            <CircleMarker
              center={center}
              radius={6.5}
              pathOptions={{
                color: "#edf7ff",
                fillColor: color,
                fillOpacity: 0.86,
                opacity: 0.95,
                weight: 1,
              }}
            />
            <CircleMarker
              center={center}
              radius={15}
              pathOptions={{
                color,
                fillOpacity: 0,
                opacity: 0.36,
                weight: 1.2,
                dashArray: "2 5",
              }}
              interactive={false}
            />
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
