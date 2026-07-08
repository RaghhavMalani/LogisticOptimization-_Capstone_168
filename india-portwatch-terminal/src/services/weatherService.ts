import { marineWeatherIntelligence, weatherSignals } from "@/data/weather";
import type { MarineWeatherIntelligence, WeatherSignal } from "@/types/portwatch";

export interface WeatherFeedAdapter {
  key: string;
  provider: "IMD" | "INCOIS" | "ECMWF" | "GFS" | "INSAT";
  layer:
    | "cyclone"
    | "wind"
    | "precipitation"
    | "wave-swell"
    | "satellite-cloud";
  endpointEnv: string;
  status: "configured-local-fallback" | "awaiting-backend";
}

export const weatherFeedAdapters: WeatherFeedAdapter[] = [
  {
    key: "imd-cyclone-bulletin",
    provider: "IMD",
    layer: "cyclone",
    endpointEnv: "VITE_IMD_WEATHER_URL",
    status: "configured-local-fallback",
  },
  {
    key: "incois-wave-swell",
    provider: "INCOIS",
    layer: "wave-swell",
    endpointEnv: "VITE_INCOIS_OCEAN_URL",
    status: "configured-local-fallback",
  },
  {
    key: "ecmwf-hres-wind",
    provider: "ECMWF",
    layer: "wind",
    endpointEnv: "VITE_ECMWF_FORECAST_URL",
    status: "awaiting-backend",
  },
  {
    key: "gfs-precip-forecast",
    provider: "GFS",
    layer: "precipitation",
    endpointEnv: "VITE_GFS_FORECAST_URL",
    status: "awaiting-backend",
  },
  {
    key: "insat-cloud-proxy",
    provider: "INSAT",
    layer: "satellite-cloud",
    endpointEnv: "VITE_SATELLITE_TILE_URL",
    status: "configured-local-fallback",
  },
];

export function listWeatherSignals(): WeatherSignal[] {
  return weatherSignals;
}

export function getWeatherSignal(portCode: string): WeatherSignal {
  return (
    weatherSignals.find((signal) => signal.portCode === portCode) ??
    weatherSignals[0]
  );
}

export function getMarineWeatherIntelligence(): MarineWeatherIntelligence {
  return marineWeatherIntelligence;
}

export function listWeatherFeedAdapters(): WeatherFeedAdapter[] {
  return weatherFeedAdapters;
}
