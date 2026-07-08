import { MapContainer, TileLayer, CircleMarker, Tooltip, Polyline, Circle, Pane, LayerGroup } from "react-leaflet";
import L from "leaflet";
import { PORTS, CHOKEPOINTS, ROUTES, VESSELS } from "@/data/portwatch";
import { useEffect, useState } from "react";

// Convert schematic x/y (used previously for chokepoints/vessels) to approximate lat/lon
// The old coordinate system covered ~ lat 5..35, lon 60..95 across x:-140..1160, y:100..900
function xyToLatLon(x: number, y: number): [number, number] {
  const lon = 60 + ((x + 140) / 1300) * 35;
  const lat = 35 - ((y - 100) / 800) * 30;
  return [lat, lon];
}

const CHOKE_LATLON: Record<string, [number, number]> = {
  HRMZ: [26.57, 56.25],
  BAB: [12.58, 43.33],
  SUEZ: [30.0, 32.55],
  MLC: [2.5, 101.5],
};

const RISK_COLOR_HEX: Record<string, string> = {
  normal: "#7ef0b4",
  congested: "#ffb347",
  severe: "#ff5566",
  lowconf: "#c58cff",
};

const VESSEL_COLOR: Record<string, string> = {
  CONT: "#7dd3fc",
  TANKER: "#ffb347",
  BULK: "#7ef0b4",
  LNG: "#c58cff",
};

interface Props {
  focus?: string;
}

export default function RealMap({ focus }: Props) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2500);
    return () => clearInterval(id);
  }, []);

  const focusPort = focus ? PORTS.find((p) => p.code === focus || p.short === focus) : undefined;
  const center: [number, number] = focusPort ? [focusPort.lat, focusPort.lon] : [17, 82];

  return (
    <MapContainer
      center={center}
      zoom={5}
      minZoom={4}
      maxZoom={9}
      zoomControl={false}
      attributionControl={false}
      preferCanvas
      className="absolute inset-0 w-full h-full"
      style={{ background: "#0a1420" }}
      worldCopyJump={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
        subdomains={["a", "b", "c", "d"]}
      />
      <Pane name="grat" style={{ zIndex: 300, pointerEvents: "none" }}>
        <Graticule />
      </Pane>

      {/* Weather overlay: cyclone-like circle over Bay of Bengal */}
      <LayerGroup>
        <Circle center={[13.5, 88]} radius={420000} pathOptions={{ color: "#ffb347", weight: 1, fillColor: "#ffb347", fillOpacity: 0.06, dashArray: "4 6" }} />
        <Circle center={[13.5, 88]} radius={220000} pathOptions={{ color: "#ff5566", weight: 1, fillColor: "#ff5566", fillOpacity: 0.10, dashArray: "2 4" }} />
        <Circle center={[13.5, 88]} radius={80000} pathOptions={{ color: "#ff5566", weight: 1.4, fillColor: "#ff5566", fillOpacity: 0.18 }} />
      </LayerGroup>

      {/* Routes port -> chokepoint */}
      {ROUTES.map((r, i) => {
        const from = PORTS.find((p) => p.code === r.from);
        const to = CHOKE_LATLON[r.to];
        if (!from || !to) return null;
        const color = r.risk === "elevated" ? "#ff5566" : r.risk === "watch" ? "#ffb347" : "#7ef0b4";
        return (
          <Polyline
            key={i}
            positions={[[from.lat, from.lon], to]}
            pathOptions={{ color, weight: 1.1, opacity: 0.75, dashArray: "6 6" }}
          />
        );
      })}

      {/* Chokepoints */}
      {Object.entries(CHOKE_LATLON).map(([code, ll]) => {
        const meta = CHOKEPOINTS.find((c) => c.code === code)!;
        return (
          <CircleMarker
            key={code}
            center={ll}
            radius={5}
            pathOptions={{ color: "#7dd3fc", fillColor: "#0a1420", fillOpacity: 1, weight: 1.5 }}
          >
            <Tooltip permanent direction="right" offset={[6, 0]} className="pw-tip pw-tip-cyan">
              ◆ {meta.name}
            </Tooltip>
          </CircleMarker>
        );
      })}

      {/* Vessels — plot from schematic x/y projected to lat/lon */}
      {VESSELS.map((v) => {
        const jitter = Math.sin((tick + v.x) / 3) * 0.03;
        const [lat, lon] = xyToLatLon(v.x, v.y);
        return (
          <CircleMarker
            key={v.id}
            center={[lat + jitter, lon - jitter]}
            radius={2.4}
            pathOptions={{ color: VESSEL_COLOR[v.type], fillColor: VESSEL_COLOR[v.type], fillOpacity: 0.9, weight: 0.5 }}
          />
        );
      })}

      {/* Ports */}
      {PORTS.map((p) => {
        const color = RISK_COLOR_HEX[p.risk];
        const haloR = 30000 + p.congestion * 90000;
        return (
          <LayerGroup key={p.code}>
            <Circle
              center={[p.lat, p.lon]}
              radius={haloR}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.10, weight: 0.6, opacity: 0.5 }}
            />
            {p.risk === "severe" && (
              <Circle
                center={[p.lat, p.lon]}
                radius={haloR * 1.2}
                pathOptions={{ color: "#ff5566", weight: 0.6, opacity: 0.5, fillOpacity: 0, dashArray: "2 3" }}
              />
            )}
            <CircleMarker
              center={[p.lat, p.lon]}
              radius={focusPort?.code === p.code ? 6 : 3.5}
              pathOptions={{ color, fillColor: "#0a1420", fillOpacity: 1, weight: 1.4 }}
            >
              <Tooltip permanent direction="right" offset={[6, 0]} className="pw-tip">
                <span style={{ color }}>■</span> {p.short} · {(p.congestion * 100).toFixed(0)}%
              </Tooltip>
            </CircleMarker>
          </LayerGroup>
        );
      })}
    </MapContainer>
  );
}

function Graticule() {
  // draw meridians/parallels as polylines
  const lines: [number, number][][] = [];
  for (let lat = -10; lat <= 40; lat += 5) lines.push([[lat, 40], [lat, 110]]);
  for (let lon = 40; lon <= 110; lon += 5) lines.push([[-10, lon], [40, lon]]);
  return (
    <>
      {lines.map((pos, i) => (
        <Polyline key={i} positions={pos} pathOptions={{ color: "#38bdf8", weight: 0.3, opacity: 0.15 }} />
      ))}
    </>
  );
}

// Prevent tree-shaking of L default marker icons if ever used
void L;
