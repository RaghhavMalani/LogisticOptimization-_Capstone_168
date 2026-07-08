import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import { MapControls } from "./MapControls";
import { DEFAULT_MAP_LAYERS, type MapLayerVisibility } from "./types";
import { marineWeatherIntelligence } from "@/data/weather";
import { arcLatLng, colorForRisk } from "@/components/map/mapUtils";
import type { PortOperationalSnapshot } from "@/services/portService";
import type {
  Chokepoint,
  ChokepointRoute,
  GeoPoint,
  SARSignal,
  VesselKind,
  VesselOperationalStatus,
  VesselProxy,
  WeatherSignal,
} from "@/types/portwatch";

interface MapAlert {
  id: string;
  portCode: string;
  severity: string;
  text: string;
  ts: string;
}

interface ScreenPoint {
  x: number;
  y: number;
  visible: boolean;
}

interface AISContact {
  id: string;
  location: GeoPoint;
  heading: number;
  type: VesselKind;
  status: VesselOperationalStatus;
  speed: number;
  confidence: number;
  source: VesselProxy["source"];
  destination: string;
  lane: string;
  named?: VesselProxy;
}

interface Corridor {
  id: string;
  lane: string;
  start: GeoPoint;
  control: GeoPoint;
  end: GeoPoint;
  count: number;
  type: VesselKind;
  status: VesselOperationalStatus;
  destination: string;
  source?: VesselProxy["source"];
  offset: number;
}

const mapStyle: StyleSpecification = {
  version: 8,
  sources: {
    esriWorldImagery: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Esri World Imagery",
    },
    cartoDarkLabels: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png",
        "https://d.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "CARTO",
    },
  },
  layers: [
    {
      id: "esri-world-imagery",
      type: "raster",
      source: "esriWorldImagery",
      paint: {
        "raster-brightness-min": 0.02,
        "raster-brightness-max": 0.92,
        "raster-contrast": 0.18,
        "raster-saturation": 0.08,
      },
    },
    {
      id: "carto-dark-labels",
      type: "raster",
      source: "cartoDarkLabels",
      paint: {
        "raster-opacity": 0.36,
      },
    },
  ],
};

const trafficCorridors: Corridor[] = [
  {
    id: "hormuz-west",
    lane: "HORMUZ - MUNDRA/JNPT",
    start: { lat: 24.4, lon: 58.2 },
    control: { lat: 22.8, lon: 64.8 },
    end: { lat: 19.1, lon: 72.2 },
    count: 12,
    type: "TANKER",
    status: "underway",
    destination: "INBOM",
    offset: 0,
  },
  {
    id: "arabian-container",
    lane: "ARABIAN SEA CONTAINER LANE",
    start: { lat: 11.2, lon: 58.6 },
    control: { lat: 13.4, lon: 67.5 },
    end: { lat: 18.8, lon: 72.7 },
    count: 14,
    type: "CONT",
    status: "underway",
    destination: "INNSA",
    offset: 1,
  },
  {
    id: "west-coast-coastal",
    lane: "WEST COAST COASTAL RUN",
    start: { lat: 7.4, lon: 76.0 },
    control: { lat: 12.4, lon: 72.2 },
    end: { lat: 21.9, lon: 69.9 },
    count: 11,
    type: "GENERAL_CARGO",
    status: "underway",
    destination: "INMUN",
    offset: 2,
  },
  {
    id: "bay-chennai",
    lane: "CHENNAI APPROACH LANE",
    start: { lat: 10.8, lon: 88.8 },
    control: { lat: 11.8, lon: 84.8 },
    end: { lat: 13.0, lon: 80.9 },
    count: 10,
    type: "CONT",
    status: "approach",
    destination: "INMAA",
    offset: 3,
  },
  {
    id: "bay-east-coast",
    lane: "BAY OF BENGAL EAST COAST",
    start: { lat: 8.2, lon: 91.2 },
    control: { lat: 14.8, lon: 88.0 },
    end: { lat: 21.4, lon: 87.5 },
    count: 13,
    type: "BULK",
    status: "underway",
    destination: "INHAL",
    offset: 4,
  },
  {
    id: "malacca-india",
    lane: "MALACCA - EAST INDIA",
    start: { lat: 2.8, lon: 100.2 },
    control: { lat: 6.4, lon: 94.2 },
    end: { lat: 12.8, lon: 81.2 },
    count: 15,
    type: "CONT",
    status: "underway",
    destination: "INMAA",
    offset: 5,
  },
  {
    id: "red-sea-reroute",
    lane: "RED SEA DISRUPTION REROUTE",
    start: { lat: 12.6, lon: 43.8 },
    control: { lat: 9.4, lon: 55.8 },
    end: { lat: 8.4, lon: 76.2 },
    count: 10,
    type: "TANKER",
    status: "rerouted",
    destination: "INBOM",
    source: "AIS_SAR",
    offset: 6,
  },
  {
    id: "bay-weather-box",
    lane: "BAY WEATHER AVOIDANCE BOX",
    start: { lat: 5.6, lon: 84.2 },
    control: { lat: 9.4, lon: 89.4 },
    end: { lat: 16.2, lon: 91.0 },
    count: 8,
    type: "PATROL",
    status: "restricted",
    destination: "INMAA",
    source: "AIS_SAR",
    offset: 7,
  },
];

const satelliteClouds = [
  {
    id: "himalayan-outflow",
    center: { lat: 24.2, lon: 88.6 },
    size: [620, 190],
    rotation: -18,
    tone: "cloud",
    opacity: 0.42,
  },
  {
    id: "north-bay-rain",
    center: { lat: 18.8, lon: 88.1 },
    size: [450, 220],
    rotation: -32,
    tone: "rain",
    opacity: 0.46,
  },
  {
    id: "central-bay-convective",
    center: { lat: 13.4, lon: 84.6 },
    size: [500, 340],
    rotation: 18,
    tone: "convective",
    opacity: 0.52,
  },
  {
    id: "southwest-monsoon-cloud",
    center: { lat: 7.2, lon: 72.4 },
    size: [480, 150],
    rotation: -8,
    tone: "rain",
    opacity: 0.34,
  },
  {
    id: "andaman-cloud-plume",
    center: { lat: 10.4, lon: 94.6 },
    size: [390, 180],
    rotation: -28,
    tone: "cloud",
    opacity: 0.36,
  },
] as const;

function bezierPoint(
  start: GeoPoint,
  control: GeoPoint,
  end: GeoPoint,
  t: number,
): GeoPoint {
  const u = 1 - t;
  return {
    lat: u * u * start.lat + 2 * u * t * control.lat + t * t * end.lat,
    lon: u * u * start.lon + 2 * u * t * control.lon + t * t * end.lon,
  };
}

function bezierLine(corridor: Corridor, steps = 42): GeoPoint[] {
  return Array.from({ length: steps + 1 }, (_, index) =>
    bezierPoint(corridor.start, corridor.control, corridor.end, index / steps),
  );
}

function headingBetween(from: GeoPoint, to: GeoPoint): number {
  const dy = to.lat - from.lat;
  const dx = to.lon - from.lon;
  return Math.round(((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360);
}

function colorForStatus(contact: Pick<AISContact, "confidence" | "status">) {
  if (contact.confidence < 0.74) return "#c58cff";
  if (contact.status === "restricted" || contact.status === "rerouted") {
    return "#ff5566";
  }
  if (
    contact.status === "anchored" ||
    contact.status === "waiting" ||
    contact.status === "delayed"
  ) {
    return "#ffb347";
  }
  if (contact.status === "berthed") return "#7ef0b4";
  return "#7dd3fc";
}

function namedVesselColor(vessel: VesselProxy) {
  if (vessel.confidence < 0.74 || vessel.riskExposure === "proxy") {
    return "#c58cff";
  }
  if (
    vessel.status === "restricted" ||
    vessel.status === "rerouted" ||
    vessel.riskExposure === "severe"
  ) {
    return "#ff5566";
  }
  if (
    vessel.status === "anchored" ||
    vessel.status === "waiting" ||
    vessel.status === "delayed" ||
    vessel.riskExposure === "high"
  ) {
    return "#ffb347";
  }
  if (vessel.status === "berthed" || vessel.riskExposure === "low") {
    return "#7ef0b4";
  }
  return "#7dd3fc";
}

function buildTrafficContacts(vessels: VesselProxy[]): AISContact[] {
  const corridorContacts = trafficCorridors.flatMap((corridor) =>
    Array.from({ length: corridor.count }, (_, index) => {
      const t = (index + 1) / (corridor.count + 1);
      const base = bezierPoint(corridor.start, corridor.control, corridor.end, t);
      const next = bezierPoint(
        corridor.start,
        corridor.control,
        corridor.end,
        Math.min(0.98, t + 0.025),
      );
      const heading = headingBetween(base, next);
      const side = ((heading + 90) * Math.PI) / 180;
      const wobble = Math.sin((index + 1) * 1.7 + corridor.offset) * 0.16;
      const confidence =
        index % 9 === 0 ? 0.7 : 0.82 + ((index + corridor.offset) % 5) * 0.025;
      return {
        id: `${corridor.id}-${index + 1}`,
        location: {
          lat: base.lat + Math.cos(side) * wobble,
          lon: base.lon + Math.sin(side) * wobble,
        },
        heading,
        type:
          index % 11 === 0
            ? "LNG"
            : index % 7 === 0
              ? "GENERAL_CARGO"
              : corridor.type,
        status:
          index % 13 === 0
            ? "delayed"
            : index % 17 === 0
              ? "restricted"
              : corridor.status,
        speed: 8 + ((index + corridor.offset) % 9),
        confidence,
        source: confidence < 0.74 ? "SAR" : corridor.source ?? "AIS",
        destination: corridor.destination,
        lane: corridor.lane,
      } satisfies AISContact;
    }),
  );

  const namedContacts = vessels.map((vessel) => ({
    id: vessel.id,
    location: vessel.location,
    heading: vessel.heading,
    type: vessel.vesselType,
    status: vessel.status ?? "underway",
    speed: vessel.speedKnots,
    confidence: vessel.confidence,
    source: vessel.source,
    destination: vessel.destinationPortCode ?? "IND",
    lane:
      vessel.approachLane ??
      vessel.anchorageZone ??
      vessel.routeId ??
      vessel.berthId ??
      "AIS OPEN SEA",
    named: vessel,
  }));

  return [...corridorContacts, ...namedContacts];
}

function windLines() {
  const generated = [
    ...Array.from({ length: 13 }, (_, index) => ({
      start: { lat: 5.4 + index * 1.35, lon: 50.2 + (index % 3) * 1.2 },
      control: { lat: 7.8 + index * 1.1, lon: 61.2 + Math.sin(index) * 2.2 },
      end: { lat: 8.4 + index * 0.85, lon: 73.5 + Math.cos(index * 0.8) * 1.5 },
      speedKnots: 18 + (index % 5) * 2,
    })),
    ...Array.from({ length: 15 }, (_, index) => ({
      start: { lat: 4.6 + index * 0.85, lon: 78.4 + (index % 4) * 1.1 },
      control: { lat: 8.8 + index * 0.55, lon: 86.2 + Math.sin(index * 0.7) * 2.3 },
      end: { lat: 13.4 + index * 0.42, lon: 91.8 - (index % 5) * 0.7 },
      speedKnots: 24 + (index % 6) * 2,
    })),
    ...Array.from({ length: 10 }, (_, index) => ({
      start: { lat: -0.8 + index * 0.72, lon: 68.8 + index * 1.3 },
      control: { lat: 2.8 + index * 0.56, lon: 77.2 + index * 0.9 },
      end: { lat: 6.4 + index * 0.48, lon: 87.6 + index * 0.52 },
      speedKnots: 20 + (index % 4) * 3,
    })),
  ];

  return [
    ...marineWeatherIntelligence.windField.map((wind) => ({
      start: wind.start,
      control: wind.control,
      end: wind.end,
      speedKnots: wind.speedKnots,
    })),
    ...generated,
  ];
}

function movedPoint(contact: AISContact, tick: number, index: number): GeoPoint {
  const heading = (contact.heading * Math.PI) / 180;
  const underway =
    contact.status === "underway" ||
    contact.status === "approach" ||
    contact.status === "rerouted" ||
    contact.status === "restricted";
  const distance = underway ? Math.min(0.08, contact.speed * 0.0025) : 0.006;
  const phase = tick * (underway ? 0.28 : 0.1) + index * 0.42;
  const crossTrack = Math.sin(phase) * (underway ? 0.006 : 0.012);
  return {
    lat:
      contact.location.lat +
      Math.cos(heading) * distance * Math.sin(phase * 0.45) +
      Math.cos(heading + Math.PI / 2) * crossTrack,
    lon:
      contact.location.lon +
      Math.sin(heading) * distance * Math.sin(phase * 0.45) +
      Math.sin(heading + Math.PI / 2) * crossTrack,
  };
}

function riskTone(risk: string) {
  if (risk === "severe") return "#ff5566";
  if (risk === "congested") return "#ffb347";
  if (risk === "lowconf") return "#c58cff";
  return "#7ef0b4";
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [layers, setLayers] = useState<MapLayerVisibility>(DEFAULT_MAP_LAYERS);
  const [ready, setReady] = useState(false);
  const [viewVersion, setViewVersion] = useState(0);
  const [tick, setTick] = useState(0);
  const contacts = useMemo(() => buildTrafficContacts(vessels), [vessels]);
  const winds = useMemo(windLines, []);

  const toggleLayer = (key: keyof MapLayerVisibility) =>
    setLayers((current) => ({ ...current, [key]: !current[key] }));

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    let cancelled = false;

    void import("maplibre-gl").then((maplibregl) => {
      if (!containerRef.current || cancelled) return;
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: mapStyle,
        center: [78.4, 16.4],
        zoom: 4.65,
        minZoom: 3.3,
        maxZoom: 9.5,
        maxBounds: [
          [37, -6],
          [106, 34],
        ],
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
      });

      mapRef.current = map;
      const bump = () => setViewVersion((value) => value + 1);
      map.on("load", () => {
        setReady(true);
        bump();
      });
      map.on("move", bump);
      map.on("zoom", bump);
      map.on("resize", bump);
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 1300);
    return () => window.clearInterval(timer);
  }, []);

  const dimensions = ready
    ? {
        width: mapRef.current?.getContainer().clientWidth ?? 1,
        height: mapRef.current?.getContainer().clientHeight ?? 1,
      }
    : { width: 1, height: 1 };

  const project = (point: GeoPoint): ScreenPoint | null => {
    const map = mapRef.current;
    if (!map) return null;
    const projected = map.project([point.lon, point.lat]);
    return {
      x: projected.x,
      y: projected.y,
      visible:
        projected.x > -260 &&
        projected.y > -260 &&
        projected.x < dimensions.width + 260 &&
        projected.y < dimensions.height + 260,
    };
  };

  const pathFromPoints = (points: GeoPoint[]) => {
    const projected = points.map(project).filter(Boolean) as ScreenPoint[];
    if (projected.length < 2) return "";
    return projected
      .map((point, index) =>
        index === 0 ? `M ${point.x} ${point.y}` : `L ${point.x} ${point.y}`,
      )
      .join(" ");
  };

  void viewVersion;

  return (
    <div className="absolute inset-0 bg-[oklch(0.08_0.02_240)]">
      <div ref={containerRef} className="absolute inset-0 pw-maplibre-map" />

      <div className="pointer-events-none absolute inset-0 z-10 pw-map-ocean-tint" />
      <div className="pointer-events-none absolute inset-0 z-10 pw-map-vignette" />
      <div className="pointer-events-none absolute inset-0 z-20 grid-bg opacity-20" />
      <div className="pointer-events-none absolute inset-0 z-20 scanlines opacity-60" />

      {ready && (
        <div className="pointer-events-none absolute inset-0 z-[24] overflow-hidden">
          {layers.weather &&
            satelliteClouds.map((cloud) => {
              const point = project(cloud.center);
              if (!point?.visible) return null;
              return (
                <span
                  key={cloud.id}
                  className={`pw-satellite-cloud pw-satellite-${cloud.tone}`}
                  style={
                    {
                      "--cloud-w": `${cloud.size[0]}px`,
                      "--cloud-h": `${cloud.size[1]}px`,
                      "--cloud-rotate": `${cloud.rotation}deg`,
                      "--cloud-opacity": cloud.opacity,
                      left: point.x,
                      top: point.y,
                    } as React.CSSProperties
                  }
                >
                  <i />
                  <b />
                  <em />
                </span>
              );
            })}

          {layers.weather && (
            <CycloneOverlay project={project} />
          )}

          <svg
            className="absolute inset-0 h-full w-full"
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            preserveAspectRatio="none"
          >
            {layers.weather &&
              winds.map((wind, index) => {
                const d = pathFromPoints(
                  Array.from({ length: 30 }, (_, step) =>
                    bezierPoint(wind.start, wind.control, wind.end, step / 29),
                  ),
                );
                if (!d) return null;
                return (
                  <path
                    key={`wind-${index}`}
                    d={d}
                    fill="none"
                    stroke={wind.speedKnots > 30 ? "#9ff7ff" : "#1fc7e6"}
                    strokeWidth={wind.speedKnots > 30 ? 1.1 : 0.58}
                    strokeDasharray={wind.speedKnots > 30 ? "2 9" : "1 12"}
                    opacity={wind.speedKnots > 30 ? 0.42 : 0.22}
                    className="pw-wind-streamline"
                  />
                );
              })}

            {layers.routes &&
              trafficCorridors.map((corridor) => {
                const d = pathFromPoints(bezierLine(corridor));
                if (!d) return null;
                return (
                  <path
                    key={corridor.id}
                    d={d}
                    fill="none"
                    stroke={
                      corridor.status === "rerouted" ||
                      corridor.status === "restricted"
                        ? "#ff5566"
                        : "#1fc7e6"
                    }
                    strokeWidth="0.9"
                    strokeDasharray="3 8"
                    opacity="0.35"
                    className="pw-ais-corridor-line"
                  />
                );
              })}

            {layers.routes &&
              routes.map((route) => {
                const from = ports.find((port) => port.code === route.fromPortCode);
                const to = chokepoints.find(
                  (chokepoint) => chokepoint.code === route.toChokepointCode,
                );
                if (!from || !to) return null;
                const d = pathFromPoints(arcLatLng(from.location, to.location).map(([lat, lon]) => ({ lat, lon })));
                return (
                  <path
                    key={route.label}
                    d={d}
                    fill="none"
                    stroke={route.risk === "severe" ? "#ff5566" : "#7dd3fc"}
                    strokeWidth="0.8"
                    strokeDasharray="5 8"
                    opacity="0.42"
                    className="pw-route-dash-line"
                  />
                );
              })}
          </svg>
        </div>
      )}

      {ready && layers.vessels && (
        <div className="pointer-events-none absolute inset-0 z-[34] overflow-hidden">
          {contacts.map((contact, index) => {
            const moved = movedPoint(contact, tick, index);
            const point = project(moved);
            if (!point?.visible) return null;
            const color = contact.named
              ? namedVesselColor(contact.named)
              : colorForStatus(contact);
            return (
              <span
                key={contact.id}
                className={`pw-maplibre-vessel ${contact.named ? "named" : "traffic"} ${contact.source === "SAR" ? "sar" : ""}`}
                style={
                  {
                    "--vessel-color": color,
                    "--vessel-heading": `${contact.heading}deg`,
                    left: point.x,
                    top: point.y,
                  } as React.CSSProperties
                }
                title={`${contact.id} · ${contact.type} · ${contact.destination} · ${contact.lane}`}
              >
                <svg viewBox="0 0 36 36" aria-hidden="true">
                  <path
                    className="hull"
                    d="M18 2.8 C24.4 8.2 26.8 18.3 23.4 29 L18 33.2 L12.6 29 C9.2 18.3 11.6 8.2 18 2.8 Z"
                  />
                  <path
                    className="detail"
                    d="M14 13 H22 M14.6 18 H21.4 M15.2 23 H20.8"
                  />
                </svg>
              </span>
            );
          })}
        </div>
      )}

      {ready && layers.sar && (
        <svg
          className="pointer-events-none absolute inset-0 z-[36] h-full w-full"
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          preserveAspectRatio="none"
        >
          {sarSignals.map((signal) => {
            const port = ports.find((item) => item.code === signal.portCode);
            const point = port ? project(port.location) : null;
            if (!point?.visible) return null;
            return (
              <g key={signal.sceneId}>
                <ellipse
                  cx={point.x + 18}
                  cy={point.y + 10}
                  rx={20 + signal.sarOnly * 0.6}
                  ry={9 + signal.darkVessels}
                  fill="none"
                  stroke="#c58cff"
                  strokeDasharray="3 5"
                  opacity="0.45"
                />
              </g>
            );
          })}
        </svg>
      )}

      {ready && layers.ports && (
        <div className="absolute inset-0 z-[42] overflow-hidden">
          {ports.map((port) => {
            const point = project(port.location);
            if (!point?.visible) return null;
            const color = colorForRisk(port.risk);
            return (
              <button
                key={port.code}
                type="button"
                className="pw-maplibre-port"
                style={
                  {
                    "--port-color": color,
                    "--port-size": `${52 + port.congestion * 42}px`,
                    left: point.x,
                    top: point.y,
                  } as React.CSSProperties
                }
                onClick={() => onPortSelect(port.code)}
              >
                <span className="halo" />
                <span className="core" />
                <span className="label">
                  <b>{port.short}</b>
                  <i>{Math.round(port.congestion * 100)}</i>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {ready && layers.alerts && (
        <div className="pointer-events-none absolute inset-0 z-[46] overflow-hidden">
          {alerts.slice(0, 5).map((alert) => {
            const port = ports.find((item) => item.code === alert.portCode);
            const point = port ? project(port.location) : null;
            if (!point?.visible) return null;
            return (
              <span
                key={alert.id}
                className="pw-maplibre-alert"
                style={{
                  left: point.x + 18,
                  top: point.y - 36,
                  borderColor: riskTone(alert.severity),
                  color: riskTone(alert.severity),
                }}
              >
                {alert.text}
              </span>
            );
          })}
        </div>
      )}

      <MapControls layers={layers} onToggle={toggleLayer} />
      <div className="absolute bottom-[118px] left-3 z-30 flex items-center gap-3 border border-[var(--color-cyan)]/25 bg-[oklch(0.10_0.02_240_/_0.72)] backdrop-blur px-2 py-1 text-[9px] tracking-widest text-[var(--color-muted-foreground)]">
        <span>MAPLIBRE GL</span>
        <span>PORTS {ports.length}</span>
        <span>AIS CONTACTS {contacts.length}</span>
        <span>WX FEEDS {weatherSignals.length}</span>
        <span>SAT BASE + DARK LABELS</span>
      </div>
    </div>
  );
}

function CycloneOverlay({
  project,
}: {
  project: (point: GeoPoint) => ScreenPoint | null;
}) {
  const cyclone = marineWeatherIntelligence.cyclone;
  const point = project(cyclone.center);
  if (!point?.visible) return null;
  return (
    <span
      className="pw-maplibre-cyclone"
      style={{ left: point.x, top: point.y }}
    >
      <svg viewBox="0 0 250 250" aria-hidden="true">
        <defs>
          <radialGradient id="stormCloudMapLibre" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff7da" stopOpacity="0.6" />
            <stop offset="18%" stopColor="#ffb347" stopOpacity="0.42" />
            <stop offset="45%" stopColor="#7dd3fc" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse className="cloud" cx="125" cy="125" rx="122" ry="94" />
        <ellipse className="band band-a" cx="125" cy="125" rx="114" ry="46" />
        <ellipse className="band band-b" cx="125" cy="125" rx="96" ry="38" />
        <ellipse className="band band-c" cx="125" cy="125" rx="132" ry="52" />
        <g className="rotor">
          <path d="M125 36 C174 43 199 78 178 111 C160 139 116 135 109 109 C102 82 136 71 151 91" />
          <path d="M125 214 C76 207 51 172 72 139 C90 111 134 115 141 141 C148 168 114 179 99 159" />
          <path d="M44 128 C53 78 92 58 125 78 C155 96 151 140 122 147 C94 154 78 118 101 101" />
          <path d="M206 122 C197 172 158 192 125 172 C95 154 99 110 128 103 C156 96 172 132 149 149" />
        </g>
        <circle className="eye" cx="125" cy="125" r="7" />
      </svg>
      <b>{cyclone.name}</b>
      <em>
        {cyclone.pressureHpa} hPa · {cyclone.maxWindKnots} kt
      </em>
    </span>
  );
}
