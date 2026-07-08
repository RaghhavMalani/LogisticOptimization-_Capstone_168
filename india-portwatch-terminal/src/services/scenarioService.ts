import { scenarioDefinitions } from "@/data/scenarios";
import { ports, portRisks } from "@/data/ports";
import type {
  DecisionRecommendation,
  OperationalRiskLevel,
  ScenarioDefinition,
  ScenarioKey,
  ScenarioResult,
} from "@/types/portwatch";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function riskFromScore(score: number): OperationalRiskLevel {
  if (score >= 86) return "severe";
  if (score >= 68) return "high";
  if (score >= 42) return "medium";
  return "normal";
}

function scenarioByKeyOrAlias(input: string): ScenarioDefinition {
  const normalized = input.trim().toUpperCase();
  return (
    scenarioDefinitions.find((scenario) => scenario.key === normalized || scenario.commandAlias === normalized) ??
    scenarioDefinitions[0]
  );
}

function recommendationFor(resultSeed: {
  scenario: ScenarioDefinition;
  riskLevel: OperationalRiskLevel;
  intensity: number;
  congestionDelta: number;
  delayDeltaHours: number;
}): DecisionRecommendation {
  const { scenario, riskLevel, intensity, congestionDelta, delayDeltaHours } = resultSeed;
  const coastalAction = scenario.affectedCoasts.includes("east")
    ? "Move discretionary east-coast calls to later tide windows"
    : "Protect west-coast berth windows for crude, LNG and priority containers";
  return {
    id: `REC-${scenario.key}-${intensity.toFixed(1)}`,
    scenarioKey: scenario.key,
    severity: riskLevel,
    title:
      riskLevel === "severe"
        ? "Escalate to national berth coordination"
        : riskLevel === "high"
          ? "Activate targeted congestion controls"
          : "Monitor and pre-stage buffers",
    actions: [
      coastalAction,
      "Stagger inbound ETAs by 24-48h for high-risk vessels",
      "Reserve yard capacity for priority cargo classes",
      "Push updated delay guidance to fleet operators",
    ],
    rationale: `Deterministic demo engine projects +${congestionDelta.toFixed(0)}% congestion pressure and +${delayDeltaHours.toFixed(1)}h delay at ${scenario.name.toLowerCase()} intensity ${intensity.toFixed(1)}x.`,
    confidence: clamp(0.78 + intensity * 0.05, 0, 0.94),
    timestamp: "08:45:00Z",
  };
}

export function listScenarioDefinitions(): ScenarioDefinition[] {
  return scenarioDefinitions;
}

export function resolveScenarioKey(input: string): ScenarioKey {
  return scenarioByKeyOrAlias(input).key;
}

export function simulateScenario(input: string, intensity = 1.5, runId = 1247): ScenarioResult {
  const scenario = scenarioByKeyOrAlias(input);
  const safeIntensity = clamp(intensity, 0.5, 2);
  const affectedPorts = ports
    .map((port) => {
      const risk = portRisks.find((item) => item.portCode === port.code)!;
      const coastMultiplier = scenario.affectedCoasts.includes(port.coast) ? 1 : 0.42;
      const chokepointMultiplier =
        scenario.key === "HORMUZ" && ["INMUN", "INIXY", "INBOM", "INNSA", "INCOK"].includes(port.code)
          ? 1.28
          : scenario.key === "REDSEA" && port.coast === "west"
            ? 1.15
            : 1;
      const congestionDelta = clamp(scenario.baseCongestionDelta * safeIntensity * coastMultiplier * chokepointMultiplier, 0, 0.7);
      const delayDeltaHours = scenario.baseDelayDeltaHours * safeIntensity * coastMultiplier * chokepointMultiplier;
      const throughputDelta = scenario.baseThroughputDelta * safeIntensity * coastMultiplier;
      const impactScore = clamp((risk.congestion + congestionDelta) * 100 + delayDeltaHours * 1.4, 0, 99);
      return {
        portCode: port.code,
        impactScore: Math.round(impactScore),
        riskLevel: riskFromScore(impactScore),
        congestionDelta,
        delayDeltaHours,
        throughputDelta,
      };
    })
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 8);

  const congestionDelta =
    (affectedPorts.reduce((sum, port) => sum + port.congestionDelta, 0) / Math.max(1, affectedPorts.length)) * 100;
  const delayDeltaHours = affectedPorts.reduce((sum, port) => sum + port.delayDeltaHours, 0) / Math.max(1, affectedPorts.length);
  const throughputDelta =
    (affectedPorts.reduce((sum, port) => sum + port.throughputDelta, 0) / Math.max(1, affectedPorts.length)) * 100;
  const freightDelta = clamp(delayDeltaHours * 0.78, 1.5, 18);
  const riskLevel = riskFromScore(Math.max(...affectedPorts.map((port) => port.impactScore)));

  return {
    scenarioKey: scenario.key,
    scenarioName: scenario.name,
    intensity: safeIntensity,
    runId,
    affectedPorts,
    congestionDelta,
    delayDeltaHours,
    throughputDelta,
    freightDelta,
    riskLevel,
    recommendation: recommendationFor({ scenario, riskLevel, intensity: safeIntensity, congestionDelta, delayDeltaHours }),
    routeImpacts: [
      { name: "West Coast Route", delayDeltaHours: delayDeltaHours * (scenario.affectedCoasts.includes("west") ? 1.1 : 0.65), riskLevel: scenario.affectedCoasts.includes("west") ? riskLevel : "medium" },
      { name: "East Coast Route", delayDeltaHours: delayDeltaHours * (scenario.affectedCoasts.includes("east") ? 1.05 : 0.55), riskLevel: scenario.affectedCoasts.includes("east") ? riskLevel : "medium" },
      { name: "India -> Europe", delayDeltaHours: scenario.key === "REDSEA" ? delayDeltaHours * 1.35 : delayDeltaHours * 0.9, riskLevel: scenario.key === "REDSEA" ? "severe" : riskLevel },
      { name: "India -> US East Coast", delayDeltaHours: delayDeltaHours * 0.8, riskLevel },
      { name: "India -> GCC", delayDeltaHours: scenario.key === "HORMUZ" ? delayDeltaHours * 1.4 : delayDeltaHours * 0.65, riskLevel: scenario.key === "HORMUZ" ? "severe" : "medium" },
    ],
    chokepointImpacts: [
      { name: "Strait of Hormuz", riskLevel: scenario.key === "HORMUZ" ? "severe" : scenario.affectedCoasts.includes("west") ? "high" : "medium" },
      { name: "Bab-el-Mandeb", riskLevel: scenario.key === "REDSEA" ? "severe" : "medium" },
      { name: "Malacca Strait", riskLevel: scenario.affectedCoasts.includes("east") ? "high" : "normal" },
      { name: "Suez Canal", riskLevel: scenario.key === "REDSEA" ? "high" : "normal" },
      { name: "Cape of Good Hope", riskLevel: scenario.key === "REDSEA" ? "medium" : "normal" },
    ],
  };
}
