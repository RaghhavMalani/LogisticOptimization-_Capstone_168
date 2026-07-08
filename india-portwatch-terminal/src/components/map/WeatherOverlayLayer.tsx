import { Circle, LayerGroup, Polygon, Polyline, Tooltip } from "react-leaflet";
import type { PortOperationalSnapshot } from "@/services/portService";
import type { WeatherSignal } from "@/types/portwatch";
import { asLatLng } from "./mapUtils";

const precipBands: Array<{
  id: string;
  tone: string;
  opacity: number;
  points: [number, number][];
}> = [
  {
    id: "sw-monsoon-band",
    tone: "#2ee6c7",
    opacity: 0.16,
    points: [
      [5, 58],
      [9, 62],
      [11, 69],
      [11, 77],
      [9, 83],
      [6, 87],
      [3, 86],
      [2, 76],
      [3, 66],
    ],
  },
  {
    id: "bay-convection",
    tone: "#45b9ff",
    opacity: 0.14,
    points: [
      [12, 82],
      [18, 87],
      [21, 94],
      [18, 99],
      [13, 98],
      [10, 92],
      [10, 86],
    ],
  },
  {
    id: "cyclone-watch",
    tone: "#ff5566",
    opacity: 0.08,
    points: [
      [10.2, 82.8],
      [8.2, 84.8],
      [8.1, 88.4],
      [10.5, 91.2],
      [14, 91.8],
      [17.3, 89.5],
      [17.2, 85.6],
      [14.4, 82.7],
    ],
  },
];

const windVectors: [number, number, number][] = [
  [13, 58, 92],
  [12, 61, 94],
  [11, 64, 96],
  [10, 67, 98],
  [9, 70, 100],
  [8.5, 73, 102],
  [8.8, 76, 105],
  [9.5, 79, 108],
  [11, 82, 112],
  [13, 85, 118],
  [15, 88, 124],
  [17, 91, 132],
];

function windLine(
  lat: number,
  lon: number,
  heading: number,
): [number, number][] {
  const radians = (heading * Math.PI) / 180;
  return [
    [lat, lon],
    [lat + Math.cos(radians) * 1.1, lon + Math.sin(radians) * 1.8],
  ];
}

export function WeatherOverlayLayer({
  ports,
  signals,
  visible,
}: {
  ports: PortOperationalSnapshot[];
  signals: WeatherSignal[];
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <LayerGroup>
      {precipBands.map((band) => (
        <Polygon
          key={band.id}
          positions={band.points}
          pathOptions={{
            color: band.tone,
            fillColor: band.tone,
            fillOpacity: band.opacity,
            opacity: 0.42,
            weight: 1,
            dashArray: "4 5",
          }}
        />
      ))}
      {windVectors.map(([lat, lon, heading], index) => (
        <Polyline
          key={`${lat}-${lon}-${index}`}
          positions={windLine(lat, lon, heading)}
          pathOptions={{
            color: "#7dd3fc",
            opacity: 0.52,
            weight: 1,
            dashArray: "5 6",
          }}
        />
      ))}
      {signals.map((signal) => {
        const port = ports.find((item) => item.code === signal.portCode);
        if (!port) return null;
        const color =
          signal.impactScore > 0.7
            ? "#ff5566"
            : signal.impactScore > 0.55
              ? "#ffb347"
              : "#7dd3fc";
        return (
          <Circle
            key={signal.portCode}
            center={asLatLng(port.location)}
            radius={36000 + signal.impactScore * 88000}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.08,
              opacity: 0.5,
              weight: 1.2,
              dashArray: "3 4",
            }}
          >
            <Tooltip className="pw-port-tooltip" direction="right">
              <div className="pw-tooltip-card">
                <div className="text-[var(--color-cyan)]">WX {port.short}</div>
                <div>
                  {signal.windKnots}kt wind, {signal.waveHeightM}m waves
                </div>
                <div>
                  Impact {signal.impactScore.toFixed(2)} · cyclone{" "}
                  {Math.round(signal.cycloneRisk7d * 100)}%
                </div>
              </div>
            </Tooltip>
          </Circle>
        );
      })}
    </LayerGroup>
  );
}
