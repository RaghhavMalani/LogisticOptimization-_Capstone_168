import type { HSMMRegime } from "@/types/portwatch";

export const hsmmRegimes: HSMMRegime[] = [
  {
    portCode: "INMAA",
    state: "CONGESTED_HIGH",
    probabilities: { normal: 0, congested: 0.07, severe: 0.91 },
    daysInState: 3.2,
    expectedRemainingDays: 1.3,
    transitionRisk24h: 0.63,
    confidence: 0.93,
    timestamp: "08:41:11Z",
  },
  {
    portCode: "INNSA",
    state: "CONGESTED_HIGH",
    probabilities: { normal: 0.03, congested: 0.18, severe: 0.79 },
    daysInState: 2.7,
    expectedRemainingDays: 1.8,
    transitionRisk24h: 0.58,
    confidence: 0.9,
    timestamp: "08:40:40Z",
  },
  {
    portCode: "INVTZ",
    state: "CONGESTED_MED",
    probabilities: { normal: 0.14, congested: 0.67, severe: 0.19 },
    daysInState: 1.1,
    expectedRemainingDays: 1.5,
    transitionRisk24h: 0.39,
    confidence: 0.86,
    timestamp: "08:39:42Z",
  },
];
