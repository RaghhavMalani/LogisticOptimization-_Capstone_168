import L from "leaflet";
import { LayerGroup, Marker, Polyline, Tooltip } from "react-leaflet";
import { marineWeatherIntelligence } from "@/data/weather";
import type { GeoPoint, WindVector } from "@/types/portwatch";

interface Streamline {
  id: string;
  start: GeoPoint;
  control: GeoPoint;
  end: GeoPoint;
  speedKnots: number;
  gustKnots: number;
  directionDeg: number;
  source: WindVector["source"];
  label: string;
  diagnostic?: boolean;
}

function makeStream(
  id: string,
  start: GeoPoint,
  control: GeoPoint,
  end: GeoPoint,
  speedKnots: number,
  source: WindVector["source"],
): Streamline {
  return {
    id,
    start,
    control,
    end,
    speedKnots,
    gustKnots: speedKnots + 8,
    directionDeg: Math.round(
      ((Math.atan2(end.lon - start.lon, end.lat - start.lat) * 180) / Math.PI + 360) %
        360,
    ),
    source,
    label: "Marine wind streamline",
    diagnostic: true,
  };
}

const generatedStreams: Streamline[] = [
  ...Array.from({ length: 13 }, (_, index) =>
    makeStream(
      `arabian-fine-${index}`,
      { lat: 5.4 + index * 1.35, lon: 50.2 + (index % 3) * 1.2 },
      { lat: 7.8 + index * 1.1, lon: 61.2 + Math.sin(index) * 2.2 },
      { lat: 8.4 + index * 0.85, lon: 73.5 + Math.cos(index * 0.8) * 1.5 },
      18 + (index % 5) * 2,
      index % 2 ? "ECMWF" : "INCOIS",
    ),
  ),
  ...Array.from({ length: 15 }, (_, index) =>
    makeStream(
      `bay-cyclonic-${index}`,
      { lat: 4.6 + index * 0.85, lon: 78.4 + (index % 4) * 1.1 },
      { lat: 8.8 + index * 0.55, lon: 86.2 + Math.sin(index * 0.7) * 2.3 },
      { lat: 13.4 + index * 0.42, lon: 91.8 - (index % 5) * 0.7 },
      24 + (index % 6) * 2,
      index % 3 ? "GFS" : "ECMWF",
    ),
  ),
  ...Array.from({ length: 10 }, (_, index) =>
    makeStream(
      `south-equatorial-${index}`,
      { lat: -0.8 + index * 0.72, lon: 68.8 + index * 1.3 },
      { lat: 2.8 + index * 0.56, lon: 77.2 + index * 0.9 },
      { lat: 6.4 + index * 0.48, lon: 87.6 + index * 0.52 },
      20 + (index % 4) * 3,
      "INCOIS",
    ),
  ),
  ...Array.from({ length: 8 }, (_, index) =>
    makeStream(
      `malacca-outflow-${index}`,
      { lat: 1.6 + index * 0.65, lon: 100.4 },
      { lat: 5.8 + index * 0.58, lon: 96.8 - Math.sin(index) },
      { lat: 9.6 + index * 0.45, lon: 90.8 - index * 0.35 },
      18 + (index % 4) * 2,
      "GFS",
    ),
  ),
];

function curve(start: GeoPoint, control: GeoPoint, end: GeoPoint, steps = 34): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const u = 1 - t;
    points.push([
      u * u * start.lat + 2 * u * t * control.lat + t * t * end.lat,
      u * u * start.lon + 2 * u * t * control.lon + t * t * end.lon,
    ]);
  }
  return points;
}

function pointAt(points: [number, number][], ratio: number): [number, number] {
  const index = Math.min(points.length - 1, Math.max(0, Math.round((points.length - 1) * ratio)));
  return points[index];
}

function windParticleIcon(vector: Streamline, index: number) {
  const size = vector.speedKnots > 30 ? 18 : 14;
  return L.divIcon({
    className: "pw-wind-particle-icon",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `
      <span class="pw-wind-particle" style="--wind-delay:${index * 0.55}s; --wind-rotate:${vector.directionDeg}deg; --wind-size:${size}px">
        <i></i>
      </span>
    `,
  });
}

function windColor(vector: Streamline) {
  if (vector.speedKnots >= 32) return "#ffb347";
  if (vector.speedKnots >= 26) return "#9ff7ff";
  return "#7dd3fc";
}

export function WindStreamlineLayer({ visible }: { visible: boolean }) {
  if (!visible) return null;
  const streams: Streamline[] = [
    ...marineWeatherIntelligence.windField,
    ...generatedStreams,
  ];

  return (
    <LayerGroup>
      {streams.map((vector, index) => {
        const line = curve(vector.start, vector.control, vector.end);
        const color = windColor(vector);
        return (
          <LayerGroup key={vector.id}>
            <Polyline
              positions={line}
              pathOptions={{
                color,
                opacity: vector.diagnostic ? 0.2 : vector.speedKnots >= 30 ? 0.46 : 0.34,
                weight: vector.diagnostic ? 0.58 : vector.speedKnots >= 30 ? 1.2 : 0.85,
                dashArray: vector.speedKnots >= 30 ? "2 9" : "1 12",
                className: "pw-wind-streamline",
              }}
            />
            {index % 3 === 0 && (
              <Marker position={pointAt(line, 0.58)} icon={windParticleIcon(vector, index)}>
                <Tooltip className="pw-port-tooltip" direction="top">
                  <div className="pw-tooltip-card">
                    <div className="text-[var(--color-cyan)]">WIND FIELD · {vector.source}</div>
                    <div>{vector.label}</div>
                    <div className="grid grid-cols-[64px_54px] gap-x-2 tabular-nums">
                      <span>WIND</span>
                      <b>{vector.speedKnots} kt</b>
                      <span>GUST</span>
                      <b>{vector.gustKnots} kt</b>
                      <span>DIR</span>
                      <b>{vector.directionDeg} deg</b>
                    </div>
                  </div>
                </Tooltip>
              </Marker>
            )}
          </LayerGroup>
        );
      })}
    </LayerGroup>
  );
}
