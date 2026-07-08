import { riskColorHex } from "@/data/ports";
import type { GeoPoint, RiskLevel } from "@/types/portwatch";

export function colorForRisk(risk: RiskLevel): string {
  return riskColorHex[risk];
}

export function colorForStatus(status: string): string {
  if (status === "severe") return "#ff5566";
  if (status === "elevated" || status === "watch" || status === "high")
    return "#ffb347";
  if (status === "medium") return "#7dd3fc";
  return "#7ef0b4";
}

export function colorForVesselSource(source: string): string {
  if (source === "SAR") return "#c58cff";
  if (source === "AIS_SAR") return "#ffb347";
  return "#7dd3fc";
}

export function asLatLng(point: GeoPoint): [number, number] {
  return [point.lat, point.lon];
}

export function arcLatLng(
  from: GeoPoint,
  to: GeoPoint,
  steps = 42,
): [number, number][] {
  const startLon = from.lon;
  const startLat = from.lat;
  const endLon = to.lon;
  const endLat = to.lat;
  const dx = endLon - startLon;
  const dy = endLat - startLat;
  const controlLon = (startLon + endLon) / 2 - dy * 0.18;
  const controlLat = (startLat + endLat) / 2 + dx * 0.1;
  const points: [number, number][] = [];

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const u = 1 - t;
    const lon = u * u * startLon + 2 * u * t * controlLon + t * t * endLon;
    const lat = u * u * startLat + 2 * u * t * controlLat + t * t * endLat;
    points.push([lat, lon]);
  }

  return points;
}
