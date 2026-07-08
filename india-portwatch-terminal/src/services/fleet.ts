import { getJson } from "./api";
import { listFleetVessels } from "./fleetService";
import type { FleetVessel } from "@/types/portwatch";

export async function fetchFleetVessels(): Promise<FleetVessel[]> {
  return getJson<FleetVessel[]>("/fleet", () => listFleetVessels());
}
