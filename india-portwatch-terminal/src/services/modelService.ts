import { gatingWeights, modelPipelineStatuses, tftForecasts } from "@/data/forecasts";
import { hsmmRegimes } from "@/data/regimes";
import type { DecisionRecommendation, HSMMRegime, ModelPipelineStatus, TFTForecastPoint } from "@/types/portwatch";

export function listModelPipelineStatuses(): ModelPipelineStatus[] {
  return modelPipelineStatuses;
}

export function listGatingWeights() {
  return gatingWeights;
}

export function getForecastForPort(portCode: string): TFTForecastPoint[] {
  const forecast = tftForecasts.filter((point) => point.portCode === portCode);
  return forecast.length > 0 ? forecast : tftForecasts;
}

export function getHSMMRegime(portCode: string): HSMMRegime {
  return hsmmRegimes.find((regime) => regime.portCode === portCode) ?? hsmmRegimes[0];
}

export function getDecisionRecommendation(portCode: string): DecisionRecommendation {
  const regime = getHSMMRegime(portCode);
  return {
    id: `DEC-${portCode}`,
    portCode,
    severity: regime.probabilities.severe > 0.75 ? "severe" : regime.probabilities.congested > 0.55 ? "high" : "medium",
    title: "Activate congestion protocol",
    actions: ["Prioritize berth allocation", "Stagger arrivals", "Advise vessels to slow steam", "Review alternate port capacity"],
    rationale: "Weather, SAR/AIS queue growth, and HSMM dwell-state persistence all point to elevated delay risk.",
    confidence: regime.confidence,
    timestamp: regime.timestamp,
  };
}
