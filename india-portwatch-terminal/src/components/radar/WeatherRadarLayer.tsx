import L from "leaflet";
import { LayerGroup, Marker, Tooltip } from "react-leaflet";
import { marineWeatherIntelligence } from "@/data/weather";
import type { WeatherRadarCell } from "@/types/portwatch";

interface CloudMass {
  id: string;
  label: string;
  center: [number, number];
  size: [number, number];
  rotation: number;
  tone: "cloud" | "rain" | "convective";
  opacity: number;
}

const cloudMasses: CloudMass[] = [
  {
    id: "himalayan-outflow",
    label: "Upper cloud shield",
    center: [24.2, 88.6],
    size: [620, 190],
    rotation: -18,
    tone: "cloud",
    opacity: 0.42,
  },
  {
    id: "north-bay-rain",
    label: "North Bay rain shield",
    center: [18.8, 88.1],
    size: [450, 220],
    rotation: -32,
    tone: "rain",
    opacity: 0.46,
  },
  {
    id: "central-bay-convective",
    label: "Central Bay convection",
    center: [13.8, 86.2],
    size: [420, 300],
    rotation: 18,
    tone: "convective",
    opacity: 0.5,
  },
  {
    id: "southwest-monsoon-cloud",
    label: "Southwest monsoon cloud street",
    center: [7.2, 72.4],
    size: [480, 150],
    rotation: -8,
    tone: "rain",
    opacity: 0.34,
  },
  {
    id: "andaman-cloud-plume",
    label: "Andaman moisture plume",
    center: [10.4, 94.6],
    size: [390, 180],
    rotation: -28,
    tone: "cloud",
    opacity: 0.36,
  },
];

function cellSize(cell: WeatherRadarCell) {
  return Math.round(Math.max(110, Math.min(340, cell.radiusKm * 0.9)));
}

function cellIcon(cell: WeatherRadarCell) {
  const size = cellSize(cell);
  return L.divIcon({
    className: "pw-radar-cell-icon",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `
      <span class="pw-radar-cell pw-radar-${cell.intensity}" style="--cell-size:${size}px; --cell-delay:${cell.driftHours * 0.22}s; --cell-rotation:${cell.movementDeg}deg">
        <i></i><b></b><em></em><strong></strong>
      </span>
    `,
  });
}

function cloudIcon(cloud: CloudMass) {
  return L.divIcon({
    className: "pw-satellite-cloud-icon",
    iconSize: cloud.size,
    iconAnchor: [cloud.size[0] / 2, cloud.size[1] / 2],
    html: `
      <span class="pw-satellite-cloud pw-satellite-${cloud.tone}" style="--cloud-w:${cloud.size[0]}px; --cloud-h:${cloud.size[1]}px; --cloud-rotate:${cloud.rotation}deg; --cloud-opacity:${cloud.opacity}">
        <i></i><b></b><em></em>
      </span>
    `,
  });
}

export function WeatherRadarLayer({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <LayerGroup>
      {cloudMasses.map((cloud) => (
        <Marker key={cloud.id} position={cloud.center} icon={cloudIcon(cloud)}>
          <Tooltip className="pw-port-tooltip" direction="top">
            <div className="pw-tooltip-card">
              <div className="text-[var(--color-cyan)]">SATELLITE WX · INSAT</div>
              <div>{cloud.label}</div>
            </div>
          </Tooltip>
        </Marker>
      ))}
      {marineWeatherIntelligence.radarCells.map((cell) => (
        <Marker
          key={cell.id}
          position={[cell.center.lat, cell.center.lon]}
          icon={cellIcon(cell)}
        >
          <Tooltip className="pw-port-tooltip" direction="top">
            <div className="pw-tooltip-card">
              <div className="text-[var(--color-cyan)]">WX RADAR · {cell.source}</div>
              <div>{cell.label}</div>
              <div className="grid grid-cols-[78px_58px] gap-x-2 tabular-nums">
                <span>INTENSITY</span>
                <b>{cell.intensity.toUpperCase()}</b>
                <span>RAIN RATE</span>
                <b>{cell.precipitationRateMmH} mm/h</b>
                <span>MOTION</span>
                <b>{cell.movementDeg} deg</b>
              </div>
            </div>
          </Tooltip>
        </Marker>
      ))}
    </LayerGroup>
  );
}
