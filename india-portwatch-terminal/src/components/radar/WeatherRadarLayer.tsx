import L from "leaflet";
import { LayerGroup, Marker, Tooltip } from "react-leaflet";

interface RadarCell {
  id: string;
  label: string;
  center: [number, number];
  size: number;
  intensity: "light" | "moderate" | "heavy" | "severe";
  drift: number;
}

const cells: RadarCell[] = [
  {
    id: "bay-core",
    label: "Bay of Bengal convective core",
    center: [14.4, 87.8],
    size: 210,
    intensity: "severe",
    drift: 0,
  },
  {
    id: "bay-rain-band-n",
    label: "North bay rain band",
    center: [18.2, 86.4],
    size: 170,
    intensity: "heavy",
    drift: 0.35,
  },
  {
    id: "chennai-squall",
    label: "Chennai coastal squall line",
    center: [13.1, 81.7],
    size: 145,
    intensity: "moderate",
    drift: 0.7,
  },
  {
    id: "arabian-monsoon",
    label: "Arabian Sea monsoon cells",
    center: [17.8, 70.4],
    size: 185,
    intensity: "moderate",
    drift: 1.1,
  },
  {
    id: "kochi-rain",
    label: "Kerala coastal precipitation",
    center: [10.2, 75.4],
    size: 125,
    intensity: "light",
    drift: 1.5,
  },
];

function cellIcon(cell: RadarCell) {
  return L.divIcon({
    className: "pw-radar-cell-icon",
    iconSize: [cell.size, cell.size],
    iconAnchor: [cell.size / 2, cell.size / 2],
    html: `
      <span class="pw-radar-cell pw-radar-${cell.intensity}" style="--cell-size:${cell.size}px; --cell-delay:${cell.drift}s">
        <i></i><b></b><em></em>
      </span>
    `,
  });
}

export function WeatherRadarLayer({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <LayerGroup>
      {cells.map((cell) => (
        <Marker key={cell.id} position={cell.center} icon={cellIcon(cell)}>
          <Tooltip className="pw-port-tooltip" direction="top">
            <div className="pw-tooltip-card">
              <div className="text-[var(--color-cyan)]">WX RADAR</div>
              <div>{cell.label}</div>
              <div>Intensity {cell.intensity.toUpperCase()}</div>
            </div>
          </Tooltip>
        </Marker>
      ))}
    </LayerGroup>
  );
}
