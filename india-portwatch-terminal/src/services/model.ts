import { getJson } from "./api";
import {
  getDecisionRecommendation,
  getForecastForPort,
  getHSMMRegime,
  listGatingWeights,
  listModelPipelineStatuses,
} from "./modelService";
import type {
  DecisionRecommendation,
  HSMMRegime,
  ModelPipelineStatus,
  TFTForecastPoint,
} from "@/types/portwatch";

export async function fetchModelPipelineStatuses(): Promise<
  ModelPipelineStatus[]
> {
  return getJson<ModelPipelineStatus[]>("/model/pipeline", () =>
    listModelPipelineStatuses(),
  );
}

export async function fetchHSMMRegime(portCode: string): Promise<HSMMRegime> {
  return getJson<HSMMRegime>(`/model/${portCode}/regime`, () =>
    getHSMMRegime(portCode),
  );
}

export async function fetchForecastForPort(
  portCode: string,
): Promise<TFTForecastPoint[]> {
  return getJson<TFTForecastPoint[]>(`/model/${portCode}/forecast`, () =>
    getForecastForPort(portCode),
  );
}

export async function fetchDecisionRecommendation(
  portCode: string,
): Promise<DecisionRecommendation> {
  return getJson<DecisionRecommendation>(`/model/${portCode}/decision`, () =>
    getDecisionRecommendation(portCode),
  );
}

export function localGatingWeights() {
  return listGatingWeights();
}
