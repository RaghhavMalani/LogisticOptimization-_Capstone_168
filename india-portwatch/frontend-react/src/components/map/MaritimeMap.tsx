import { useEffect, useRef, useState } from "react";
import maplibregl, { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Pin, Vessel } from "../../api";
import ChokepointRouteLayer from "./ChokepointRouteLayer";
import PortRiskLayer from "./PortRiskLayer";
import PortTooltip from "./PortTooltip";
import VesselProxyLayer from "./VesselProxyLayer";
import WeatherOverlayLayer from "./WeatherOverlayLayer";

const INDIA_FALLBACK = {
  type: "FeatureCollection" as const,
  features: [
    {
      type: "Feature" as const,
      properties: { name: "India coastline fallback" },
      geometry: {
        type: "Polygon" as const,
        coordinates: [[
          [66.9, 23.6], [68.6, 22.8], [70.4, 21.3], [71.7, 19.5],
          [72.5, 18.2], [73.1, 16.4], [73.7, 14.4], [74.8, 12.0],
          [76.2, 9.4], [77.6, 8.1], [79.3, 9.4], [80.2, 12.3],
          [80.3, 14.9], [81.8, 16.9], [83.6, 18.4], [86.2, 20.2],
          [88.7, 21.9], [89.7, 22.8], [88.8, 23.6], [86.0, 22.9],
          [83.1, 21.0], [80.5, 18.2], [78.6, 15.7], [77.0, 12.5],
          [75.0, 11.0], [73.2, 14.8], [71.4, 18.6], [69.0, 22.0],
          [66.9, 23.6],
        ]],
      },
    },
    {
      type: "Feature" as const,
      properties: { name: "Arabian Peninsula fallback" },
      geometry: {
        type: "Polygon" as const,
        coordinates: [[[42, 12], [57, 13], [58, 29], [46, 31], [42, 22], [42, 12]]],
      },
    },
    {
      type: "Feature" as const,
      properties: { name: "Southeast Asia fallback" },
      geometry: {
        type: "Polygon" as const,
        coordinates: [[[92, 3], [103, 2], [104, 22], [94, 24], [91, 15], [92, 3]]],
      },
    },
  ],
};

function darkSatelliteStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      fallback_geography: {
        type: "geojson",
        data: INDIA_FALLBACK,
      },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#050914" } },
      {
        id: "fallback-land",
        type: "fill",
        source: "fallback_geography",
        paint: {
          "fill-color": "#172638",
          "fill-opacity": 0.38,
        },
      },
      {
        id: "fallback-coast",
        type: "line",
        source: "fallback_geography",
        paint: {
          "line-color": "#9fc8e8",
          "line-opacity": 0.58,
          "line-width": 1.2,
        },
      },
    ],
  };
}

function addOptionalRasterBasemap(map: maplibregl.Map) {
  if (!map.getSource("esri_satellite")) {
    map.addSource("esri_satellite", {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      attribution: "Esri World Imagery",
    });
  }
  if (!map.getLayer("satellite")) {
    map.addLayer({
      id: "satellite",
      type: "raster",
      source: "esri_satellite",
      paint: {
        "raster-brightness-min": 0.02,
        "raster-brightness-max": 0.52,
        "raster-saturation": -0.58,
        "raster-contrast": 0.28,
        "raster-opacity": 0.82,
      },
    }, "fallback-land");
  }
  if (!map.getSource("carto_labels")) {
    map.addSource("carto_labels", {
      type: "raster",
      tiles: ["https://a.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png"],
      tileSize: 256,
      attribution: "CARTO",
    });
  }
  if (!map.getLayer("labels")) {
    map.addLayer({
      id: "labels",
      type: "raster",
      source: "carto_labels",
      paint: { "raster-opacity": 0.52 },
    });
  }
}

function addFallbackGeography(map: maplibregl.Map) {
  const sourceId = map.getSource("fallback_geography") ? "fallback_geography" : "fallback-geography";
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, { type: "geojson", data: INDIA_FALLBACK });
  }
  if (!map.getLayer("fallback-land")) {
    const before = map.getLayer("labels") ? "labels" : undefined;
    map.addLayer({
      id: "fallback-land",
      type: "fill",
      source: sourceId,
      paint: {
        "fill-color": "#132233",
        "fill-opacity": 0.36,
      },
    }, before);
  }
  if (!map.getLayer("fallback-coast")) {
    const before = map.getLayer("labels") ? "labels" : undefined;
    map.addLayer({
      id: "fallback-coast",
      type: "line",
      source: sourceId,
      paint: {
        "line-color": "#9fc8e8",
        "line-opacity": 0.52,
        "line-width": 1.1,
      },
    }, before);
  }
}

export default function MaritimeMap({
  pins,
  vessels,
  onSelect,
}: {
  pins: Pin[];
  vessels: Vessel[];
  onSelect: (portId: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [layers, setLayers] = useState({
    weather: true,
    wind: true,
    cyclone: true,
    vessels: true,
    model: true,
    routes: true,
  });

  useEffect(() => {
    if (!host.current) return;
    const instance = new maplibregl.Map({
      container: host.current,
      style: darkSatelliteStyle(),
      center: [78.2, 16.2],
      zoom: 4.25,
      minZoom: 3.2,
      maxZoom: 9.5,
      maxBounds: [[37, -6], [106, 33]],
      attributionControl: false,
    });
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    window.requestAnimationFrame(() => instance.resize());
    let initialized = false;
    let retryTimer = 0;
    const initialize = () => {
      if (initialized) return;
      try {
        addFallbackGeography(instance);
        try {
          addOptionalRasterBasemap(instance);
        } catch (error) {
          console.warn("[portwatch] optional raster basemap unavailable", error);
        }
        initialized = true;
        setReady(true);
        window.requestAnimationFrame(() => instance.resize());
      } catch (error) {
        retryTimer = window.setTimeout(initialize, 180);
      }
    };
    instance.on("styledata", initialize);
    instance.on("style.load", initialize);
    instance.on("load", initialize);
    const fallbackTimer = window.setTimeout(initialize, 1200);
    instance.on("error", (event) => {
      console.warn("[portwatch] map tile/layer error", event?.error ?? event);
    });
    setMap(instance);
    return () => {
      window.clearTimeout(fallbackTimer);
      window.clearTimeout(retryTimer);
      instance.remove();
    };
  }, []);

  return (
    <div className="map-terminal">
      <div className="map-controls">
        <button className={layers.weather ? "active" : ""} onClick={() => setLayers((s) => ({ ...s, weather: !s.weather }))}>
          precipitation
        </button>
        <button className={layers.wind ? "active" : ""} onClick={() => setLayers((s) => ({ ...s, wind: !s.wind }))}>
          wind
        </button>
        <button className={layers.cyclone ? "active" : ""} onClick={() => setLayers((s) => ({ ...s, cyclone: !s.cyclone }))}>
          cyclone risk
        </button>
        <button className={layers.vessels ? "active" : ""} onClick={() => setLayers((s) => ({ ...s, vessels: !s.vessels }))}>
          SAR/AIS proxy
        </button>
        <button className={layers.routes ? "active" : ""} onClick={() => setLayers((s) => ({ ...s, routes: !s.routes }))}>
          chokepoints
        </button>
        <button className={layers.model ? "active" : ""} onClick={() => setLayers((s) => ({ ...s, model: !s.model }))}>
          model output
        </button>
      </div>
      <div ref={host} className="map-host" />
      {map && ready && (
        <>
          <WeatherOverlayLayer map={map} visible={layers.weather} wind={layers.wind} cyclone={layers.cyclone} />
          <ChokepointRouteLayer map={map} pins={pins} visible={layers.routes} />
          <PortRiskLayer map={map} pins={pins} labels={layers.model} />
          <VesselProxyLayer map={map} vessels={vessels} visible={layers.vessels} />
          <PortTooltip map={map} layerId="port-risk-core" onSelect={onSelect} />
        </>
      )}
      <div className="map-status-strip">
        <span>BASE MAP SATELLITE/DARK</span>
        <span>PORT NODES {pins.length}</span>
        <span>SAR/AIS PROXY {vessels.length}</span>
        <span>MODEL LAYER {layers.model ? "ON" : "OFF"}</span>
      </div>
    </div>
  );
}
