import { getJson, postJson } from "./api";
import { listScenarioDefinitions, simulateScenario } from "./scenarioService";
import type { ScenarioDefinition, ScenarioResult } from "@/types/portwatch";

export async function fetchScenarioDefinitions(): Promise<
  ScenarioDefinition[]
> {
  const local = listScenarioDefinitions();
  const remote = await getJson<Partial<ScenarioDefinition>[]>(
    "/scenarios",
    () => local,
  );
  return remote.map((scenario) => {
    const fallback =
      local.find(
        (item) =>
          item.key === scenario.key ||
          item.commandAlias === scenario.commandAlias,
      ) ?? local[0];
    return { ...fallback, ...scenario };
  });
}

export async function runScenario(
  scenarioKey: string,
  intensity: number,
  runId: number,
): Promise<ScenarioResult> {
  return postJson<ScenarioResult>(
    "/scenarios/simulate",
    { scenarioKey, intensity, runId },
    () => simulateScenario(scenarioKey, intensity, runId),
  );
}
