export type RiskLevel = "normal" | "congested" | "severe" | "lowconf";
export type OperationalRiskLevel = "normal" | "medium" | "high" | "severe";
export type Coast = "west" | "east";
export type VesselKind =
  | "TANKER"
  | "BULK"
  | "CONT"
  | "LNG"
  | "GENERAL_CARGO"
  | "PATROL"
  | "SERVICE"
  | "TUG"
  | "OTHER";
export type VesselOperationalStatus =
  | "underway"
  | "anchored"
  | "approach"
  | "berthed"
  | "waiting"
  | "delayed"
  | "restricted"
  | "rerouted";
export type ScenarioKey =
  | "STORM_W"
  | "CYC_E"
  | "LABOUR"
  | "CAPDROP"
  | "DEMAND"
  | "HORMUZ"
  | "REDSEA"
  | "FUEL";

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface RadarPoint {
  x: number;
  y: number;
}

export interface Port {
  code: string;
  name: string;
  authority: string;
  short: string;
  location: GeoPoint;
  radar: RadarPoint;
  schematic: RadarPoint;
  coast: Coast;
}

export interface PortRisk {
  portCode: string;
  risk: RiskLevel;
  congestion: number;
  delayHours: number;
  throughput: number;
  vessels: number;
  confidence: number;
  regime: string;
  updatedAt: string;
}

export interface VesselProxy {
  id: string;
  vesselType: VesselKind;
  location: GeoPoint;
  radar: RadarPoint;
  schematic: RadarPoint;
  destinationPortCode?: string;
  status?: VesselOperationalStatus;
  eta?: string;
  routeId?: string;
  berthId?: string;
  anchorageZone?: string;
  approachLane?: string;
  lengthM?: number;
  riskExposure?: "low" | "medium" | "high" | "severe" | "proxy";
  heading: number;
  speedKnots: number;
  flag: string;
  source: "AIS" | "SAR" | "AIS_SAR";
  confidence: number;
}

export interface WeatherRadarCell {
  id: string;
  label: string;
  center: GeoPoint;
  radiusKm: number;
  intensity: "light" | "moderate" | "heavy" | "severe";
  precipitationRateMmH: number;
  movementDeg: number;
  driftHours: number;
  source: "IMD" | "INSAT" | "HIMAWARI" | "ECMWF" | "GFS";
}

export interface WindVector {
  id: string;
  label: string;
  start: GeoPoint;
  control: GeoPoint;
  end: GeoPoint;
  speedKnots: number;
  gustKnots: number;
  directionDeg: number;
  source: "ECMWF" | "GFS" | "INCOIS";
}

export interface CycloneOutlook {
  id: string;
  name: string;
  center: GeoPoint;
  pressureHpa: number;
  maxWindKnots: number;
  movement: string;
  probability72h: number;
  riskWindow: string;
  forecastTrack: GeoPoint[];
  source: "IMD" | "ECMWF" | "GFS";
}

export interface MarineWeatherIntelligence {
  timestamp: string;
  sources: Array<{
    key: "IMD" | "INCOIS" | "ECMWF" | "GFS" | "INSAT" | "SAR";
    label: string;
    status: "live" | "mock-fallback" | "degraded";
    latencyMin: number;
  }>;
  radarCells: WeatherRadarCell[];
  windField: WindVector[];
  cyclone: CycloneOutlook;
  swell: {
    heightM: number;
    direction: string;
    periodSec: number;
    source: "INCOIS" | "ECMWF";
  };
}

export interface WeatherSignal {
  portCode: string;
  timestamp: string;
  windKnots: number;
  gustKnots: number;
  windDirection: string;
  rainfallMm24h: number;
  precipRateMmH: number;
  waveHeightM: number;
  visibilityKm: number;
  cycloneRisk7d: number;
  seaState: string;
  impactScore: number;
  persistenceScore: number;
  shockSigma: number;
  advisory: string;
}

export interface SARSignal {
  portCode: string;
  sceneId: string;
  timestamp: string;
  vesselDetections: number;
  anchorageCount: number;
  changeScore: number;
  confidence: number;
  aisActive: number;
  sarOnly: number;
  darkVessels: number;
  crossMatchRate: number;
  boundingIou: number;
  headingAgreement: number;
}

export interface NewsEvent {
  id: string;
  timestamp: string;
  source: string;
  tag: string;
  entity: string;
  severity: "normal" | "watch" | "elevated" | "severe";
  sentiment: number;
  text: string;
  affectedPorts: string[];
  confidence: number;
}

export interface HSMMRegime {
  portCode: string;
  state: string;
  probabilities: {
    normal: number;
    congested: number;
    severe: number;
  };
  daysInState: number;
  expectedRemainingDays: number;
  transitionRisk24h: number;
  confidence: number;
  timestamp: string;
}

export interface TFTForecastPoint {
  portCode: string;
  day: number;
  dateLabel: string;
  congestionIndex: number;
  delayHoursP95: number;
  uncertaintyBandHours: number;
  weatherProbability: number;
  severity: "LOW" | "MOD" | "HIGH" | "SEVERE";
}

export interface DecisionRecommendation {
  id: string;
  portCode?: string;
  scenarioKey?: ScenarioKey;
  severity: OperationalRiskLevel;
  title: string;
  actions: string[];
  rationale: string;
  confidence: number;
  timestamp: string;
}

export interface FleetVessel {
  imo: string;
  name: string;
  vesselType: Exclude<VesselKind, "OTHER">;
  destinationPortCode: string;
  eta: string;
  waitRisk: number;
  entryRisk: number;
  bestArrival: string;
  worstArrival: string;
  buffer: string;
  confidence: number;
}

export interface ScenarioDefinition {
  key: ScenarioKey;
  commandAlias: string;
  name: string;
  desc: string;
  icon: string;
  affectedCoasts: Coast[];
  baseCongestionDelta: number;
  baseDelayDeltaHours: number;
  baseThroughputDelta: number;
}

export interface ScenarioPortImpact {
  portCode: string;
  impactScore: number;
  riskLevel: OperationalRiskLevel;
  congestionDelta: number;
  delayDeltaHours: number;
  throughputDelta: number;
}

export interface ScenarioRouteImpact {
  name: string;
  delayDeltaHours: number;
  riskLevel: OperationalRiskLevel;
}

export interface ScenarioChokepointImpact {
  name: string;
  riskLevel: OperationalRiskLevel;
}

export interface ScenarioResult {
  scenarioKey: ScenarioKey;
  scenarioName: string;
  intensity: number;
  runId: number;
  affectedPorts: ScenarioPortImpact[];
  congestionDelta: number;
  delayDeltaHours: number;
  throughputDelta: number;
  freightDelta: number;
  riskLevel: OperationalRiskLevel;
  recommendation: DecisionRecommendation;
  routeImpacts: ScenarioRouteImpact[];
  chokepointImpacts: ScenarioChokepointImpact[];
}

export interface ModelPipelineStatus {
  key: "WX" | "NLP" | "SAR" | "DEM" | "HSMM" | "TFT" | "DEC";
  name: string;
  inputSignal: string;
  score: number;
  confidence: number;
  effectOnForecast: string;
  timestamp: string;
  modelCard?: string;
}

export interface Chokepoint {
  code: string;
  name: string;
  radar: RadarPoint;
  location: GeoPoint;
  status: "normal" | "watch" | "elevated" | "severe";
}

export interface ChokepointRoute {
  fromPortCode: string;
  toChokepointCode: string;
  label: string;
  risk: "normal" | "watch" | "elevated" | "severe";
}
