import { getJson } from "./api";
import { fetchNewsBundle } from "./news";
import { fetchSARSignals, fetchVesselProxies } from "./sar";
import { fetchWeatherSignals } from "./weather";
import { listAlertEvents, listNewsEvents } from "./newsService";
import {
  getPortSnapshot,
  listChokepointRoutes,
  listChokepoints,
  listPortOperationalSnapshots,
} from "./portService";
import { listSARSignals, listVesselProxies } from "./sarService";
import { listWeatherSignals } from "./weatherService";
import type { PortOperationalSnapshot } from "./portService";
import type {
  Chokepoint,
  ChokepointRoute,
  NewsEvent,
  SARSignal,
  VesselProxy,
  WeatherSignal,
} from "@/types/portwatch";

interface ApiPort extends Partial<PortOperationalSnapshot> {
  code: string;
  lat?: number;
  lon?: number;
}

function normalizePort(apiPort: ApiPort): PortOperationalSnapshot {
  const fallback = getPortSnapshot(apiPort.code);
  return {
    ...fallback,
    ...apiPort,
    portCode: apiPort.portCode ?? apiPort.code,
    location: apiPort.location ?? {
      lat: apiPort.lat ?? fallback.location.lat,
      lon: apiPort.lon ?? fallback.location.lon,
    },
    radar: fallback.radar,
    schematic: fallback.schematic,
  };
}

export interface RadarOverview {
  ports: PortOperationalSnapshot[];
  vessels: VesselProxy[];
  chokepoints: Chokepoint[];
  routes: ChokepointRoute[];
  alerts: ReturnType<typeof listAlertEvents>;
  weatherSignals: WeatherSignal[];
  sarSignals: SARSignal[];
  headlines: NewsEvent[];
}

export function localRadarOverview(): RadarOverview {
  return {
    ports: listPortOperationalSnapshots(),
    vessels: listVesselProxies(),
    chokepoints: listChokepoints(),
    routes: listChokepointRoutes(),
    alerts: listAlertEvents(),
    weatherSignals: listWeatherSignals(),
    sarSignals: listSARSignals(),
    headlines: listNewsEvents(),
  };
}

export async function fetchPorts(): Promise<PortOperationalSnapshot[]> {
  const ports = await getJson<ApiPort[]>("/ports", () =>
    listPortOperationalSnapshots(),
  );
  return ports.map(normalizePort);
}

export async function fetchRadarOverview(): Promise<RadarOverview> {
  const local = localRadarOverview();
  const [ports, vessels, weatherSignals, sarSignals, newsBundle] =
    await Promise.all([
      fetchPorts(),
      fetchVesselProxies(),
      fetchWeatherSignals(),
      fetchSARSignals(),
      fetchNewsBundle(),
    ]);
  return {
    ...local,
    ports,
    vessels,
    weatherSignals,
    sarSignals,
    alerts: newsBundle.alerts,
    headlines: newsBundle.events,
  };
}

export async function fetchPortSnapshot(
  portCode: string,
): Promise<PortOperationalSnapshot> {
  const port = await getJson<ApiPort>(`/ports/${portCode}`, () =>
    getPortSnapshot(portCode),
  );
  return normalizePort(port);
}
