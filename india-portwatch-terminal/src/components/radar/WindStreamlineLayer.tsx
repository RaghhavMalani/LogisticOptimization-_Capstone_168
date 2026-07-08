import { LayerGroup, Polyline } from "react-leaflet";

function curve(
  start: [number, number],
  control: [number, number],
  end: [number, number],
  steps = 24,
): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const u = 1 - t;
    points.push([
      u * u * start[0] + 2 * u * t * control[0] + t * t * end[0],
      u * u * start[1] + 2 * u * t * control[1] + t * t * end[1],
    ]);
  }
  return points;
}

const streams = [
  curve([8.6, 61], [11.2, 70.5], [10.8, 80.2]),
  curve([10.2, 63], [13.8, 72.8], [13.2, 83.8]),
  curve([12.4, 65], [17.4, 74.4], [18.6, 87.6]),
  curve([16.8, 66.8], [19.3, 73.2], [21.4, 86.8]),
  curve([21.8, 60.8], [22.6, 68.4], [20.4, 75.8]),
  curve([6.6, 80.8], [9.6, 86.6], [14.8, 91.4]),
  curve([12.1, 79.4], [14.4, 84.2], [18.3, 88.6]),
  curve([17.4, 82.8], [20.8, 88.2], [22.4, 91.8]),
] as [number, number][][];

export function WindStreamlineLayer({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <LayerGroup>
      {streams.map((line, index) => (
        <Polyline
          key={index}
          positions={line}
          pathOptions={{
            color: index % 3 === 0 ? "#7dd3fc" : "#9ff7ff",
            opacity: 0.32,
            weight: index % 2 === 0 ? 1.1 : 0.75,
            dashArray: "1 10",
            className: "pw-wind-streamline",
          }}
        />
      ))}
    </LayerGroup>
  );
}
