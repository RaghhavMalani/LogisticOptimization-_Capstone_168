import { useEffect } from "react";
import maplibregl from "maplibre-gl";
import { Pin } from "../../api";

function riskColor(regime: string) {
  if (regime === "SEVERE") return "#ff4d63";
  if (regime === "CONGESTED") return "#ffb020";
  if (regime === "NORMAL") return "#43d17d";
  return "#a889ff";
}

function featureFromPin(pin: Pin) {
  const confidence = String(pin.regime_confidence || "").toUpperCase();
  const lowConfidence = confidence === "LOW" || pin.regime === "UNKNOWN";
  const regime = lowConfidence ? "UNKNOWN" : pin.regime;
  return {
    type: "Feature" as const,
    properties: {
      id: pin.port_id,
      name: pin.name,
      regime,
      riskColor: riskColor(regime),
      congestion: pin.congestion_now,
      delay: pin.delay_hours,
      throughput: pin.throughput,
      transition: pin.transition_risk,
      confidence: pin.regime_confidence,
      size: 8 + Math.max(0, Math.min(100, pin.congestion_now)) * 0.15,
      halo: 24 + Math.max(0, Math.min(100, pin.congestion_now)) * 0.55,
      urgency: pin.regime === "SEVERE" ? 1 : pin.regime === "CONGESTED" ? 0.72 : 0.42,
    },
    geometry: { type: "Point" as const, coordinates: [pin.lon, pin.lat] },
  };
}

function setVisibility(map: maplibregl.Map, id: string, visible: boolean) {
  if (map.getLayer(id)) {
    map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}

export default function PortRiskLayer({
  map,
  pins,
  labels,
}: {
  map: maplibregl.Map;
  pins: Pin[];
  labels: boolean;
}) {
  useEffect(() => {
    const data = {
      type: "FeatureCollection" as const,
      features: pins.map(featureFromPin),
    };
    const source = map.getSource("port-risk") as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(data);
      return;
    }

    map.addSource("port-risk", { type: "geojson", data });
    map.addLayer({
      id: "port-risk-halo",
      type: "circle",
      source: "port-risk",
      paint: {
        "circle-radius": ["get", "halo"],
        "circle-color": ["get", "riskColor"],
        "circle-opacity": 0.16,
        "circle-blur": 0.72,
      },
    });
    map.addLayer({
      id: "port-risk-ring",
      type: "circle",
      source: "port-risk",
      paint: {
        "circle-radius": ["*", ["get", "size"], 1.42],
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-color": ["get", "riskColor"],
        "circle-stroke-width": 2.2,
        "circle-stroke-opacity": 0.72,
      },
    });
    map.addLayer({
      id: "port-risk-core",
      type: "circle",
      source: "port-risk",
      paint: {
        "circle-radius": ["get", "size"],
        "circle-color": ["get", "riskColor"],
        "circle-stroke-color": "#e8f1fb",
        "circle-stroke-width": 1.6,
        "circle-opacity": 0.94,
      },
    });
    map.addLayer({
      id: "port-risk-label",
      type: "symbol",
      source: "port-risk",
      layout: {
        "text-field": ["concat", ["get", "id"], "  ", ["to-string", ["round", ["get", "congestion"]]]],
        "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
        "text-size": 11,
        "text-anchor": "left",
        "text-offset": [1.4, 0],
        "text-allow-overlap": true,
      },
      paint: {
        "text-color": "#edf7ff",
        "text-halo-color": "#050914",
        "text-halo-width": 1.8,
      },
    });
  }, [map, pins]);

  useEffect(() => {
    setVisibility(map, "port-risk-label", labels);
  }, [map, labels]);

  return null;
}
