import { useEffect } from "react";
import maplibregl from "maplibre-gl";
import { Pin } from "../../api";

const CHOKEPOINTS: Record<string, { label: string; coord: [number, number]; status: "NORMAL" | "MEDIUM" | "HIGH" | "SEVERE" }> = {
  HORMUZ: { label: "Hormuz Strait", coord: [56.3, 26.6], status: "HIGH" },
  BAB: { label: "Bab-el-Mandeb", coord: [43.3, 12.6], status: "MEDIUM" },
  SUEZ: { label: "Suez Canal", coord: [39.0, 30.0], status: "NORMAL" },
  MALACCA: { label: "Malacca Strait", coord: [101.0, 2.5], status: "SEVERE" },
};

const ROUTES: [string, keyof typeof CHOKEPOINTS][] = [
  ["MUNDRA", "HORMUZ"],
  ["JNPT", "HORMUZ"],
  ["JNPT", "BAB"],
  ["COCHIN", "BAB"],
  ["TUTICORIN", "BAB"],
  ["MUNDRA", "SUEZ"],
  ["CHENNAI", "MALACCA"],
  ["VIZAG", "MALACCA"],
  ["KOLKATA", "MALACCA"],
];

function arc(a: [number, number], b: [number, number], n = 36): [number, number][] {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const cx = mx - dy * 0.18;
  const cy = my + dx * 0.12;
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const u = 1 - t;
    pts.push([
      u * u * a[0] + 2 * u * t * cx + t * t * b[0],
      u * u * a[1] + 2 * u * t * cy + t * t * b[1],
    ]);
  }
  return pts;
}

function routeColor(status: string) {
  if (status === "SEVERE") return "#ff4d63";
  if (status === "HIGH") return "#ffb020";
  if (status === "MEDIUM") return "#45b9ff";
  return "#43d17d";
}

function buildRoutes(pins: Pin[]) {
  const byId = Object.fromEntries(pins.map((p) => [p.port_id, p]));
  const routeFeatures = ROUTES.flatMap(([portId, chokepointId]) => {
    const port = byId[portId];
    const cp = CHOKEPOINTS[chokepointId];
    if (!port || !cp) return [];
    return [{
      type: "Feature" as const,
      properties: {
        portId,
        chokepoint: cp.label,
        status: cp.status,
        color: routeColor(cp.status),
      },
      geometry: {
        type: "LineString" as const,
        coordinates: arc([port.lon, port.lat], cp.coord),
      },
    }];
  });
  const pointFeatures = Object.entries(CHOKEPOINTS).map(([id, cp]) => ({
    type: "Feature" as const,
    properties: {
      id,
      label: cp.label,
      status: cp.status,
      color: routeColor(cp.status),
    },
    geometry: { type: "Point" as const, coordinates: cp.coord },
  }));
  return {
    routes: { type: "FeatureCollection" as const, features: routeFeatures },
    points: { type: "FeatureCollection" as const, features: pointFeatures },
  };
}

function setVisible(map: maplibregl.Map, visible: boolean) {
  for (const id of ["chokepoint-routes-glow", "chokepoint-routes", "chokepoint-points", "chokepoint-labels"]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}

export default function ChokepointRouteLayer({
  map,
  pins,
  visible,
}: {
  map: maplibregl.Map;
  pins: Pin[];
  visible: boolean;
}) {
  useEffect(() => {
    const data = buildRoutes(pins);
    const routeSource = map.getSource("chokepoint-routes") as maplibregl.GeoJSONSource | undefined;
    const pointSource = map.getSource("chokepoint-points") as maplibregl.GeoJSONSource | undefined;
    if (routeSource && pointSource) {
      routeSource.setData(data.routes);
      pointSource.setData(data.points);
      return;
    }

    map.addSource("chokepoint-routes", { type: "geojson", data: data.routes });
    map.addSource("chokepoint-points", { type: "geojson", data: data.points });
    map.addLayer({
      id: "chokepoint-routes-glow",
      type: "line",
      source: "chokepoint-routes",
      paint: {
        "line-color": ["get", "color"],
        "line-width": 5,
        "line-opacity": 0.12,
        "line-blur": 2,
      },
    });
    map.addLayer({
      id: "chokepoint-routes",
      type: "line",
      source: "chokepoint-routes",
      paint: {
        "line-color": ["get", "color"],
        "line-width": 1.6,
        "line-opacity": 0.72,
        "line-dasharray": [2, 2.8],
      },
    });
    map.addLayer({
      id: "chokepoint-points",
      type: "circle",
      source: "chokepoint-points",
      paint: {
        "circle-radius": 6,
        "circle-color": ["get", "color"],
        "circle-stroke-color": "#e8f1fb",
        "circle-stroke-width": 1,
        "circle-opacity": 0.86,
      },
    });
    map.addLayer({
      id: "chokepoint-labels",
      type: "symbol",
      source: "chokepoint-points",
      layout: {
        "text-field": ["concat", ["get", "label"], "\n", ["get", "status"]],
        "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
        "text-size": 10,
        "text-anchor": "left",
        "text-offset": [1, 0],
        "text-allow-overlap": true,
      },
      paint: {
        "text-color": "#dbe8f6",
        "text-halo-color": "#050914",
        "text-halo-width": 1.4,
      },
    });
  }, [map, pins]);

  useEffect(() => {
    setVisible(map, visible);
  }, [map, visible]);

  return null;
}
