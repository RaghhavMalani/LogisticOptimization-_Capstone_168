import { useEffect, useMemo } from "react";
import maplibregl from "maplibre-gl";
import { Vessel } from "../../api";

type MovingVessel = Vessel & { destination?: string; risk?: string };

function vesselFeature(vessel: MovingVessel, i: number) {
  const status = vessel.status || "proxy";
  const color =
    status === "berthed" ? "#43d17d"
    : status === "anchored" ? "#ffb020"
    : status === "restricted" ? "#a889ff"
    : "#8fd7ff";
  return {
    type: "Feature" as const,
    properties: {
      id: vessel.id || `proxy-${i}`,
      name: vessel.name || `Proxy vessel ${i + 1}`,
      status,
      speed: vessel.speed_kn,
      heading: vessel.heading,
      destination: vessel.destination || "Indian port",
      risk: vessel.risk || (status === "anchored" ? "queue watch" : "normal"),
      color,
    },
    geometry: {
      type: "Point" as const,
      coordinates: [vessel.lon, vessel.lat],
    },
  };
}

function dataFromVessels(vessels: MovingVessel[]) {
  return {
    type: "FeatureCollection" as const,
    features: vessels.map(vesselFeature),
  };
}

function setVisible(map: maplibregl.Map, visible: boolean) {
  for (const id of ["vessel-proxy-glow", "vessel-proxy-dot", "vessel-proxy-label"]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}

export default function VesselProxyLayer({
  map,
  vessels,
  visible,
}: {
  map: maplibregl.Map;
  vessels: Vessel[];
  visible: boolean;
}) {
  const seed = useMemo(() => vessels.map((v, i) => ({ ...v, id: v.id || `proxy-${i}` })), [vessels]);

  useEffect(() => {
    const source = map.getSource("vessel-proxy") as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(dataFromVessels(seed));
      return;
    }
    map.addSource("vessel-proxy", { type: "geojson", data: dataFromVessels(seed) });
    map.addLayer({
      id: "vessel-proxy-glow",
      type: "circle",
      source: "vessel-proxy",
      paint: {
        "circle-radius": ["case", ["==", ["get", "status"], "anchored"], 8.5, 5.8],
        "circle-color": ["get", "color"],
        "circle-opacity": 0.32,
        "circle-blur": 0.72,
      },
    });
    map.addLayer({
      id: "vessel-proxy-dot",
      type: "circle",
      source: "vessel-proxy",
      paint: {
        "circle-radius": ["case", ["==", ["get", "status"], "anchored"], 4.7, 3.5],
        "circle-color": ["get", "color"],
        "circle-stroke-color": "#dff7ff",
        "circle-stroke-width": 0.65,
        "circle-opacity": 0.9,
      },
    });
    map.addLayer({
      id: "vessel-proxy-label",
      type: "symbol",
      source: "vessel-proxy",
      minzoom: 6,
      layout: {
        "text-field": ["get", "status"],
        "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
        "text-size": 9,
        "text-offset": [1.1, 0.8],
        "text-anchor": "left",
      },
      paint: {
        "text-color": "#9fb3cc",
        "text-halo-color": "#050914",
        "text-halo-width": 1,
      },
    });
  }, [map, seed]);

  useEffect(() => {
    if (!visible) {
      setVisible(map, false);
      return;
    }
    setVisible(map, true);
    let live = seed.map((v) => ({ ...v }));
    const timer = window.setInterval(() => {
      live = live.map((v) => {
        if ((v.speed_kn || 0) < 0.5 || v.status === "berthed") return v;
        const heading = ((v.heading || 0) * Math.PI) / 180;
        const step = Math.min(0.018, (v.speed_kn || 1) * 0.00042);
        return {
          ...v,
          lat: v.lat + Math.cos(heading) * step,
          lon: v.lon + Math.sin(heading) * step,
        };
      });
      const source = map.getSource("vessel-proxy") as maplibregl.GeoJSONSource | undefined;
      source?.setData(dataFromVessels(live));
    }, 1100);
    return () => window.clearInterval(timer);
  }, [map, seed, visible]);

  return null;
}
