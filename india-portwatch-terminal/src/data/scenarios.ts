import type { ScenarioDefinition } from "@/types/portwatch";

export const scenarioDefinitions: ScenarioDefinition[] = [
  { key: "STORM_W", commandAlias: "STORM_WEST", name: "Storm near west coast", desc: "Severe monsoon storm tracking along Arabian Sea", icon: "storm", affectedCoasts: ["west"], baseCongestionDelta: 0.28, baseDelayDeltaHours: 6.8, baseThroughputDelta: -0.12 },
  { key: "CYC_E", commandAlias: "CYCLONE_EAST", name: "Cyclone near east coast", desc: "Bay of Bengal cyclone approaching Chennai-Vizag", icon: "cyc", affectedCoasts: ["east"], baseCongestionDelta: 0.34, baseDelayDeltaHours: 8.2, baseThroughputDelta: -0.18 },
  { key: "LABOUR", commandAlias: "LABOUR", name: "Labour strike", desc: "Port workers' strike reducing gate & yard ops", icon: "worker", affectedCoasts: ["west", "east"], baseCongestionDelta: 0.22, baseDelayDeltaHours: 5.5, baseThroughputDelta: -0.16 },
  { key: "CAPDROP", commandAlias: "CAPACITY_DROP", name: "Port capacity drop", desc: "Unplanned berth/crane outage (~20% handling)", icon: "crane", affectedCoasts: ["east"], baseCongestionDelta: 0.3, baseDelayDeltaHours: 7.4, baseThroughputDelta: -0.2 },
  { key: "DEMAND", commandAlias: "DEMAND", name: "Demand surge", desc: "Festival/quarter-end surge (+15% cargo demand)", icon: "cargo", affectedCoasts: ["west", "east"], baseCongestionDelta: 0.18, baseDelayDeltaHours: 4.2, baseThroughputDelta: -0.08 },
  { key: "HORMUZ", commandAlias: "HORMUZ", name: "Hormuz closure", desc: "Strait of Hormuz closed; Gulf crude/LNG halt", icon: "gate", affectedCoasts: ["west"], baseCongestionDelta: 0.27, baseDelayDeltaHours: 9.4, baseThroughputDelta: -0.1 },
  { key: "REDSEA", commandAlias: "REDSEA", name: "Red Sea disruption", desc: "Bab-el-Mandeb/Suez route disruption", icon: "drop", affectedCoasts: ["west"], baseCongestionDelta: 0.24, baseDelayDeltaHours: 10.2, baseThroughputDelta: -0.09 },
  { key: "FUEL", commandAlias: "FUEL", name: "Fuel price shock", desc: "Brent spike > $25/bbl; cost pressure", icon: "fuel", affectedCoasts: ["west", "east"], baseCongestionDelta: 0.1, baseDelayDeltaHours: 2.8, baseThroughputDelta: -0.04 },
];
