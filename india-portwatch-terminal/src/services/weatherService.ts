import { weatherSignals } from "@/data/weather";
import type { WeatherSignal } from "@/types/portwatch";

export function listWeatherSignals(): WeatherSignal[] {
  return weatherSignals;
}

export function getWeatherSignal(portCode: string): WeatherSignal {
  return weatherSignals.find((signal) => signal.portCode === portCode) ?? weatherSignals[0];
}
