import { useEffect, useState } from "react";
import { MapContainer, Pane, TileLayer, useMap } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import { AlertLayer } from "./AlertLayer";
import { MapControls } from "./MapControls";
import { PortRiskLayer } from "./PortRiskLayer";
import { SARLayer } from "./SARLayer";
import { DEFAULT_MAP_LAYERS, type MapLayerVisibility } from "./types";
import { CycloneSystemLayer } from "@/components/radar/CycloneSystemLayer";
import { RoutePulseLayer } from "@/components/radar/RoutePulseLayer";
import { VesselProxyLayer } from "@/components/radar/VesselProxyLayer";
import { WeatherRadarLayer } from "@/components/radar/WeatherRadarLayer";
import { WindStreamlineLayer } from "@/components/radar/WindStreamlineLayer";
import type { PortOperationalSnapshot } from "@/services/portService";
import type {
  Chokepoint,
  ChokepointRoute,
  SARSignal,
  VesselProxy,
  WeatherSignal,
} from "@/types/portwatch";

const bounds: LatLngBoundsExpression = [
  [-6, 37],
  [34, 106],
];

function MapResize() {
  const map = useMap();
  useEffect(() => {
    const resize = () => map.invalidateSize({ animate: false });
    const timer = window.setTimeout(resize, 120);
    window.addEventListener("resize", resize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", resize);
    };
  }, [map]);
  return null;
}

interface MapAlert {
  id: string;
  portCode: string;
  severity: string;
  text: string;
  ts: string;
}

export function MaritimeMap({
  ports,
  vessels,
  chokepoints,
  routes,
  alerts,
  weatherSignals,
  sarSignals,
  onPortSelect,
}: {
  ports: PortOperationalSnapshot[];
  vessels: VesselProxy[];
  chokepoints: Chokepoint[];
  routes: ChokepointRoute[];
  alerts: readonly MapAlert[];
  weatherSignals: WeatherSignal[];
  sarSignals: SARSignal[];
  onPortSelect: (portCode: string) => void;
}) {
  const [layers, setLayers] = useState<MapLayerVisibility>(DEFAULT_MAP_LAYERS);
  const toggleLayer = (key: keyof MapLayerVisibility) =>
    setLayers((current) => ({ ...current, [key]: !current[key] }));

  return (
    <div className="absolute inset-0 bg-[oklch(0.08_0.02_240)]">
      <MapContainer
        center={[16.4, 78.4]}
        zoom={4.8}
        minZoom={3.4}
        maxZoom={9.5}
        zoomSnap={0.25}
        maxBounds={bounds}
        maxBoundsViscosity={0.8}
        zoomControl={false}
        attributionControl={false}
        preferCanvas
        className="h-full w-full pw-leaflet-map"
      >
        <MapResize />
        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
          subdomains={["a", "b", "c", "d"]}
          opacity={0.32}
        />
        <Pane name="weather-pane" style={{ zIndex: 410 }}>
          <WeatherRadarLayer visible={layers.weather} />
          <WindStreamlineLayer visible={layers.weather} />
          <CycloneSystemLayer visible={layers.weather} />
        </Pane>
        <Pane name="route-pane" style={{ zIndex: 430 }}>
          <RoutePulseLayer
            ports={ports}
            chokepoints={chokepoints}
            routes={routes}
            visible={layers.routes}
          />
        </Pane>
        <Pane name="sar-pane" style={{ zIndex: 440 }}>
          <SARLayer ports={ports} signals={sarSignals} visible={layers.sar} />
        </Pane>
        <Pane name="vessel-pane" style={{ zIndex: 450 }}>
          <VesselProxyLayer vessels={vessels} visible={layers.vessels} />
        </Pane>
        <Pane name="port-pane" style={{ zIndex: 470 }}>
          <PortRiskLayer
            ports={ports}
            visible={layers.ports}
            onPortSelect={onPortSelect}
          />
        </Pane>
        <Pane name="alert-pane" style={{ zIndex: 490 }}>
          <AlertLayer alerts={alerts} ports={ports} visible={layers.alerts} />
        </Pane>
      </MapContainer>
      <div className="pointer-events-none absolute inset-0 z-10 pw-map-ocean-tint" />
      <div className="pointer-events-none absolute inset-0 z-10 pw-map-vignette" />
      <div className="pointer-events-none absolute inset-0 z-20 grid-bg opacity-20" />
      <div className="pointer-events-none absolute inset-0 z-20 scanlines opacity-60" />
      <MapControls layers={layers} onToggle={toggleLayer} />
      <div className="absolute bottom-[118px] left-3 z-30 flex items-center gap-3 border border-[var(--color-cyan)]/25 bg-[oklch(0.10_0.02_240_/_0.72)] backdrop-blur px-2 py-1 text-[9px] tracking-widest text-[var(--color-muted-foreground)]">
        <span>REAL LAT/LON</span>
        <span>PORTS {ports.length}</span>
        <span>VESSEL PROXY {vessels.length}</span>
        <span>BASE CARTO DARK</span>
      </div>
    </div>
  );
}
