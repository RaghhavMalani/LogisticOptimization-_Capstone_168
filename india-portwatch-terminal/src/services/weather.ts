import { getJson } from "./api";
import { getWeatherSignal, listWeatherSignals } from "./weatherService";
import type { WeatherSignal } from "@/types/portwatch";

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
