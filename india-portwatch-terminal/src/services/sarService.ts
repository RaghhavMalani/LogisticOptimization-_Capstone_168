import { sarSignals, vesselProxies } from "@/data/vessels";
import type { SARSignal, VesselProxy } from "@/types/portwatch";

export interface VesselFeedAdapter {
  key: string;
  provider:
    | "AIS"
    | "AIS_SAT"
    | "SENTINEL_SAR"
    | "PORTWATCH"
    | "CHOKEPOINT_ACTIVITY";
  layer: "vessel-position" | "sar-proxy" | "port-cluster" | "route-corridor";
  endpointEnv: string;
  status: "configured-local-fallback" | "awaiting-backend";
}

export const vesselFeedAdapters: VesselFeedAdapter[] = [
  {
    key: "ais-terrestrial-coastal",
    provider: "AIS",
    layer: "vessel-position",
    endpointEnv: "VITE_AIS_FEED_URL",
    status: "configured-local-fallback",
  },
  {
    key: "sat-ais-chokepoint",
    provider: "AIS_SAT",
    layer: "route-corridor",
    endpointEnv: "VITE_SAT_AIS_FEED_URL",
    status: "awaiting-backend",
  },
  {
    key: "sentinel-sar-proxy",
    provider: "SENTINEL_SAR",
    layer: "sar-proxy",
    endpointEnv: "VITE_SENTINEL_SAR_URL",
    status: "configured-local-fallback",
  },
  {
    key: "portwatch-activity",
    provider: "PORTWATCH",
    layer: "port-cluster",
    endpointEnv: "VITE_PORTWATCH_ACTIVITY_URL",
    status: "configured-local-fallback",
  },
];

export function listVesselProxies(): VesselProxy[] {
  return vesselProxies;
}

export function getSARSignal(portCode: string): SARSignal {
  return (
    sarSignals.find((signal) => signal.portCode === portCode) ?? sarSignals[0]
  );
}

export function listSARSignals(): SARSignal[] {
  return sarSignals;
}

export function listVesselFeedAdapters(): VesselFeedAdapter[] {
  return vesselFeedAdapters;
}
