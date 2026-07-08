import L from "leaflet";
import {
  Circle,
  CircleMarker,
  LayerGroup,
  Marker,
  Polyline,
  Tooltip,
} from "react-leaflet";
import type { PortOperationalSnapshot } from "@/services/portService";
import { asLatLng, colorForRisk } from "./mapUtils";
import { PortTooltip } from "./PortTooltip";

const priorityLabels = new Set([
  "INMAA",
  "INNSA",
  "INBOM",
  "INMUN",
  "INIXY",
  "INCOK",
  "INVTZ",
  "INPRT",
  "INHAL",
]);

const labelOffsets: Record<string, [number, number]> = {
  INMUN: [0.42, -1.05],
  INIXY: [0.12, 0.96],
  INBOM: [-0.42, -1.0],
  INNSA: [-0.82, 0.88],
  INMAA: [-0.54, 0.82],
  INENR: [0.35, 0.9],
  INVTZ: [0.42, 0.72],
  INPRT: [0.42, 0.74],
  INHAL: [0.24, 0.78],
  INCOK: [-0.32, 0.78],
};

function labelPoint(port: PortOperationalSnapshot): [number, number] {
  const offset = labelOffsets[port.code] ?? [0.24, 0.62];
  return [port.location.lat + offset[0], port.location.lon + offset[1]];
}

function labelIcon(port: PortOperationalSnapshot, color: string) {
  const shortName =
    port.code === "INNSA"
      ? "JNPT"
      : port.code === "INIXY"
        ? "DEENDAYAL"
        : port.code === "INHAL"
          ? "KOLKATA"
          : port.name.split(" / ")[0].split(" ")[0].toUpperCase();
  return L.divIcon({
    className: "pw-port-label-callout",
    html: `<span style="border-color:${color}; color:${color}"><b>${shortName}</b><i>${Math.round(port.congestion * 100)}</i></span>`,
    iconAnchor: [0, 15],
  });
}

function haloIcon(port: PortOperationalSnapshot, color: string) {
  return L.divIcon({
    className: "pw-port-halo-icon",
    iconSize: [74, 74],
    iconAnchor: [37, 37],
    html: `<span class="${port.risk}" style="--port-color:${color}"></span>`,
  });
}

export function PortRiskLayer({
  ports,
  visible,
  onPortSelect,
}: {
  ports: PortOperationalSnapshot[];
  visible: boolean;
  onPortSelect: (portCode: string) => void;
}) {
  if (!visible) return null;

  return (
    <LayerGroup>
      {ports.map((port) => {
        const color = colorForRisk(port.risk);
        const center = asLatLng(port.location);
        const markerRadius = 5 + port.congestion * 9;
        const haloRadius = 24000 + port.congestion * 76000;
        const shouldLabel = priorityLabels.has(port.code);
        const label = labelPoint(port);
        return (
          <LayerGroup key={port.code}>
            <Circle
              center={center}
              radius={haloRadius}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: port.risk === "severe" ? 0.11 : 0.07,
                opacity: port.risk === "normal" ? 0.16 : 0.28,
                weight: 1,
              }}
            />
            <Marker
              position={center}
              icon={haloIcon(port, color)}
              interactive={false}
            />
            <CircleMarker
              center={center}
              radius={markerRadius}
              pathOptions={{
                color: "#edf7ff",
                fillColor: color,
                fillOpacity: 0.9,
                opacity: 0.9,
                weight: 1.2,
              }}
              eventHandlers={{ click: () => onPortSelect(port.code) }}
            >
              <Tooltip
                className="pw-port-tooltip"
                direction="top"
                offset={[0, -10]}
              >
                <PortTooltip port={port} />
              </Tooltip>
            </CircleMarker>
            <CircleMarker
              center={center}
              radius={markerRadius + 6}
              pathOptions={{
                color,
                fillOpacity: 0,
                opacity: 0.55,
                weight: 1.4,
                dashArray: port.risk === "lowconf" ? "2 4" : "4 4",
              }}
              interactive={false}
            />
            {shouldLabel && (
              <>
                <Polyline
                  positions={[center, label]}
                  pathOptions={{
                    color,
                    opacity: 0.45,
                    weight: 0.8,
                    dashArray: "2 4",
                  }}
                  interactive={false}
                />
                <Marker
                  position={label}
                  icon={labelIcon(port, color)}
                  interactive={false}
                />
              </>
            )}
          </LayerGroup>
        );
      })}
    </LayerGroup>
  );
}
