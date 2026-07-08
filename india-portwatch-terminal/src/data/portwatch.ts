import { chokepoints, chokepointRoutes, ports, portRisks, riskColor, riskLabel } from "./ports";
import { alertEvents, newsEvents } from "./news";
import { fleetVessels } from "./fleet";
import { modelPipelineStatuses } from "./forecasts";
import { scenarioDefinitions } from "./scenarios";
import { vesselProxies } from "./vessels";

export type { RiskLevel as Risk, Port, PortRisk, VesselProxy as Vessel } from "@/types/portwatch";

export const PORTS = ports.map((port) => {
  const risk = portRisks.find((item) => item.portCode === port.code)!;
  return {
    code: port.code,
    name: port.name,
    short: port.short,
    lat: port.location.lat,
    lon: port.location.lon,
    x: port.schematic.x,
    y: port.schematic.y,
    risk: risk.risk,
    congestion: risk.congestion,
    delayHours: risk.delayHours,
    throughput: risk.throughput,
    vessels: risk.vessels,
    confidence: risk.confidence,
    coast: port.coast,
  };
});

export const CHOKEPOINTS = chokepoints.map((choke) => ({
  code: choke.code,
  name: choke.name,
  x: choke.radar.x * 1000,
  y: choke.radar.y * 700,
  status: choke.status,
}));

export const ROUTES = chokepointRoutes.map((route) => ({
  from: route.fromPortCode,
  to: route.toChokepointCode,
  label: route.label,
  risk: route.risk,
}));

export const RISK_COLOR = riskColor;
export const RISK_LABEL = riskLabel;

export const VESSELS = vesselProxies.map((vessel) => ({
  id: vessel.id,
  type: vessel.vesselType,
  x: vessel.schematic.x,
  y: vessel.schematic.y,
  heading: vessel.heading,
  speed: vessel.speedKnots,
  flag: vessel.flag,
}));

export const NLP_HEADLINES = newsEvents.map((event) => ({
  t: event.timestamp,
  src: event.source,
  tag: event.tag,
  sev: event.severity,
  text: event.text,
}));

export const ALERTS = alertEvents.map((alert) => ({
  id: alert.id,
  port: ports.find((port) => port.code === alert.portCode)?.short ?? alert.portCode,
  sev: alert.severity,
  text: alert.text,
  ts: alert.ts,
}));

export const PIPELINE = modelPipelineStatuses.map((step) => ({
  key: step.key,
  name: step.name,
  score: step.score,
  conf: step.confidence,
  note: step.effectOnForecast,
}));

export const SCENARIOS = scenarioDefinitions;

export const FLEET = fleetVessels.map((vessel) => ({
  imo: vessel.imo,
  name: vessel.name,
  type: vessel.vesselType,
  destPort: ports.find((port) => port.code === vessel.destinationPortCode)?.short ?? vessel.destinationPortCode,
  eta: vessel.eta,
  waitRisk: vessel.waitRisk,
  entryRisk: vessel.entryRisk,
  best: vessel.bestArrival,
  worst: vessel.worstArrival,
  buffer: vessel.buffer,
  conf: vessel.confidence,
}));

export const COMMANDS = [
  "RADAR",
  "PORT CHENNAI",
  "WX CHENNAI",
  "SAR CHENNAI",
  "NLP HORMUZ",
  "MODEL CHENNAI",
  "SIM CYCLONE_EAST 1.5",
  "FLEET",
];
