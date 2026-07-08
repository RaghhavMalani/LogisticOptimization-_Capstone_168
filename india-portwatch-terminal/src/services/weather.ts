import { getJson } from "./api";
import {
  getMarineWeatherIntelligence,
  getWeatherSignal,
  listWeatherSignals,
} from "./weatherService";
import type { MarineWeatherIntelligence, WeatherSignal } from "@/types/portwatch";

function normalizeWeather(signal: WeatherSignal): WeatherSignal {
  return signal;
}

export async function fetchWeatherSignals(): Promise<WeatherSignal[]> {
  const signals = await getJson<WeatherSignal[]>("/weather", () =>
    listWeatherSignals(),
  );
  return signals.map(normalizeWeather);
}

export async function fetchWeatherSignal(
  portCode: string,
): Promise<WeatherSignal> {
  return getJson<WeatherSignal>(`/weather/${portCode}`, () =>
    getWeatherSignal(portCode),
  );
}

export async function fetchMarineWeatherIntelligence(): Promise<MarineWeatherIntelligence> {
  return getJson<MarineWeatherIntelligence>("/weather/intelligence", () =>
    getMarineWeatherIntelligence(),
  );
}
