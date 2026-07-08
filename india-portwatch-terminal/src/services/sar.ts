import { getJson } from "./api";
import { getSARSignal, listSARSignals, listVesselProxies } from "./sarService";
import type { SARSignal, VesselProxy } from "@/types/portwatch";

interface VesselBundle {
  vessels: Array<
    Partial<VesselProxy> & { id: string; lat?: number; lon?: number }
  >;
}

function normalizeVessel(
  apiVessel: Partial<VesselProxy> & { id: string; lat?: number; lon?: number },
): VesselProxy {
  const fallback =
    listVesselProxies().find((vessel) => vessel.id === apiVessel.id) ??
    listVesselProxies()[0];
  return {
    ...fallback,
    ...apiVessel,
    location: apiVessel.location ?? {
      lat: apiVessel.lat ?? fallback.location.lat,
      lon: apiVessel.lon ?? fallback.location.lon,
    },
    radar: fallback.radar,
    schematic: fallback.schematic,
  };
}

export async function fetchVesselProxies(): Promise<VesselProxy[]> {
  const bundle = await getJson<VesselBundle>("/sar/vessels", () => ({
    vessels: listVesselProxies(),
  }));
  return bundle.vessels.map(normalizeVessel);
}

export async function fetchSARSignal(portCode: string): Promise<SARSignal> {
  return getJson<SARSignal>(`/sar/${portCode}`, () => getSARSignal(portCode));
}

export async function fetchSARSignals(): Promise<SARSignal[]> {
  return Promise.all(
    listSARSignals().map((signal) => fetchSARSignal(signal.portCode)),
  );
}
