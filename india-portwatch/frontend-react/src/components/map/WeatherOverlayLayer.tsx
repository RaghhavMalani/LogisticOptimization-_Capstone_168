import { useEffect } from "react";
import maplibregl from "maplibre-gl";

const PRECIP = {
  type: "FeatureCollection" as const,
  features: [
    {
      type: "Feature" as const,
      properties: { level: "heavy", label: "SW monsoon rain band" },
      geometry: {
        type: "Polygon" as const,
        coordinates: [[
          [58, 5], [62, 9], [69, 11], [77, 11], [83, 9], [87, 6],
          [86, 3], [76, 2], [66, 3], [58, 5],
        ]],
      },
    },
    {
      type: "Feature" as const,
      properties: { level: "moderate", label: "Bay of Bengal convection" },
      geometry: {
        type: "Polygon" as const,
        coordinates: [[
          [82, 12], [87, 18], [94, 21], [99, 18], [98, 13],
          [92, 10], [86, 10], [82, 12],
        ]],
      },
    },
  ],
};

const CYCLONE = {
  type: "FeatureCollection" as const,
  features: [
    {
      type: "Feature" as const,
      properties: { risk: "WATCH", label: "Bay of Bengal storm watch" },
      geometry: {
        type: "Polygon" as const,
        coordinates: [[
          [82.8, 10.2], [84.8, 8.2], [88.4, 8.1], [91.2, 10.5],
          [91.8, 14.0], [89.5, 17.3], [85.6, 17.2], [82.7, 14.4],
          [82.8, 10.2],
        ]],
      },
    },
  ],
};

function windFeatures() {
  const starts = [
    [58, 13, 92], [61, 12, 94], [64, 11, 96], [67, 10, 98], [70, 9, 100],
    [73, 8.5, 102], [76, 8.8, 105], [79, 9.5, 108], [82, 11, 112],
    [85, 13, 118], [88, 15, 124], [91, 17, 132],
  ];
  return {
    type: "FeatureCollection" as const,
    features: starts.map(([lon, lat, heading], i) => ({
      type: "Feature" as const,
      properties: { heading, label: `wind ${i + 1}` },
      geometry: {
        type: "LineString" as const,
        coordinates: [
          [lon, lat],
          [lon + Math.sin((heading * Math.PI) / 180) * 2.0, lat + Math.cos((heading * Math.PI) / 180) * 1.2],
        ],
      },
    })),
  };
}

function addOrUpdate(map: maplibregl.Map, id: string, data: GeoJSON.FeatureCollection) {
  const source = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
  if (source) source.setData(data);
  else map.addSource(id, { type: "geojson", data });
}

function setVisibility(map: maplibregl.Map, ids: string[], visible: boolean) {
  for (const id of ids) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}

export default function WeatherOverlayLayer({
  map,
  visible,
  wind,
  cyclone,
}: {
  map: maplibregl.Map;
  visible: boolean;
  wind: boolean;
  cyclone: boolean;
}) {
  useEffect(() => {
    addOrUpdate(map, "weather-precip", PRECIP as GeoJSON.FeatureCollection);
    addOrUpdate(map, "weather-wind", windFeatures() as GeoJSON.FeatureCollection);
    addOrUpdate(map, "weather-cyclone", CYCLONE as GeoJSON.FeatureCollection);

    if (!map.getLayer("weather-precip-fill")) {
      map.addLayer({
        id: "weather-precip-fill",
        type: "fill",
        source: "weather-precip",
        paint: {
          "fill-color": [
            "match", ["get", "level"],
            "heavy", "#2ee6c7",
            "moderate", "#45b9ff",
            "#45b9ff",
          ],
          "fill-opacity": ["match", ["get", "level"], "heavy", 0.24, "moderate", 0.18, 0.15],
        },
      });
      map.addLayer({
        id: "weather-precip-line",
        type: "line",
        source: "weather-precip",
        paint: {
          "line-color": "#8fd7ff",
          "line-opacity": 0.42,
          "line-width": 1.2,
          "line-dasharray": [2, 2],
        },
      });
    }

    if (!map.getLayer("weather-cyclone-fill")) {
      map.addLayer({
        id: "weather-cyclone-fill",
        type: "fill",
        source: "weather-cyclone",
        paint: { "fill-color": "#ff4d63", "fill-opacity": 0.09 },
      });
      map.addLayer({
        id: "weather-cyclone-line",
        type: "line",
        source: "weather-cyclone",
        paint: {
          "line-color": "#ffb020",
          "line-width": 2,
          "line-opacity": 0.7,
          "line-dasharray": [4, 4],
        },
      });
      map.addLayer({
        id: "weather-cyclone-label",
        type: "symbol",
        source: "weather-cyclone",
        layout: {
          "text-field": ["get", "label"],
          "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
          "text-size": 11,
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#ffb020",
          "text-halo-color": "#050914",
          "text-halo-width": 1.5,
        },
      });
    }

    if (!map.getLayer("weather-wind-line")) {
      map.addLayer({
        id: "weather-wind-line",
        type: "line",
        source: "weather-wind",
        paint: {
          "line-color": "#45b9ff",
          "line-width": 1.2,
          "line-opacity": 0.68,
          "line-dasharray": [5, 6],
        },
      });
      map.addLayer({
        id: "weather-wind-arrow",
        type: "symbol",
        source: "weather-wind",
        layout: {
          "symbol-placement": "line",
          "text-field": "›",
          "text-size": 18,
          "text-rotation-alignment": "map",
        },
        paint: {
          "text-color": "#7ee7ff",
          "text-halo-color": "#050914",
          "text-halo-width": 1,
        },
      });
    }
  }, [map]);

  useEffect(() => {
    setVisibility(map, ["weather-precip-fill", "weather-precip-line"], visible);
  }, [map, visible]);

  useEffect(() => {
    setVisibility(map, ["weather-wind-line", "weather-wind-arrow"], wind);
  }, [map, wind]);

  useEffect(() => {
    setVisibility(map, ["weather-cyclone-fill", "weather-cyclone-line", "weather-cyclone-label"], cyclone);
  }, [map, cyclone]);

  return null;
}
