import { sarSignals, vesselProxies } from "@/data/vessels";
import type { SARSignal, VesselProxy } from "@/types/portwatch";

export function listVesselProxies(): VesselProxy[] {
  return vesselProxies;
}

export function getSARSignal(portCode: string): SARSignal {
  return sarSignals.find((signal) => signal.portCode === portCode) ?? sarSignals[0];
}

export function listSARSignals(): SARSignal[] {
  return sarSignals;
}
