import { fleetVessels } from "@/data/fleet";
import type { FleetVessel } from "@/types/portwatch";

export function listFleetVessels(): FleetVessel[] {
  return fleetVessels;
}

export function getFleetVessel(imo: string): FleetVessel {
  return fleetVessels.find((vessel) => vessel.imo === imo) ?? fleetVessels[0];
}

export function countFleetAtRisk(threshold = 0.6): number {
  return fleetVessels.filter((vessel) => vessel.waitRisk > threshold).length;
}
