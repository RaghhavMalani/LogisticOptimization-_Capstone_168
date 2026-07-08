import type { SARSignal, VesselKind, VesselProxy } from "@/types/portwatch";

const radarSeeds: Array<[number, number, number, VesselKind]> = [
  [0.22, 0.44, 40, "CONT"], [0.26, 0.5, 55, "TANKER"], [0.3, 0.58, 90, "CONT"], [0.34, 0.62, 110, "OTHER"],
  [0.2, 0.6, 20, "CONT"], [0.16, 0.52, 350, "TANKER"], [0.12, 0.42, 10, "CONT"], [0.24, 0.36, 70, "TANKER"],
  [0.32, 0.72, 180, "CONT"], [0.4, 0.8, 200, "OTHER"], [0.48, 0.82, 250, "CONT"], [0.56, 0.78, 280, "TANKER"],
  [0.62, 0.7, 300, "CONT"], [0.66, 0.62, 320, "OTHER"], [0.7, 0.54, 340, "CONT"], [0.74, 0.46, 10, "TANKER"],
  [0.78, 0.6, 60, "CONT"], [0.82, 0.7, 100, "OTHER"], [0.86, 0.78, 140, "CONT"], [0.5, 0.72, 240, "TANKER"],
  [0.44, 0.66, 260, "CONT"], [0.58, 0.6, 300, "OTHER"], [0.68, 0.4, 20, "CONT"], [0.6, 0.34, 30, "TANKER"],
];

export const vesselProxies: VesselProxy[] = radarSeeds.map(([x, y, heading, vesselType], index) => ({
  id: `MMSI-${419000000 + index * 137}`,
  vesselType,
  radar: { x, y },
  schematic: { x: x * 1000, y: y * 700 },
  heading,
  speedKnots: 8 + (index % 12),
  flag: ["IN", "SG", "PA", "LR", "MH", "AE"][index % 6],
  source: index % 7 === 0 ? "SAR" : index % 3 === 0 ? "AIS_SAR" : "AIS",
  confidence: 0.72 + (index % 8) * 0.03,
}));

export const sarSignals: SARSignal[] = [
  {
    portCode: "INMAA",
    sceneId: "S1A_IW_20261108T003411",
    timestamp: "08:40:58Z",
    vesselDetections: 63,
    anchorageCount: 22,
    changeScore: 0.42,
    confidence: 0.79,
    aisActive: 46,
    sarOnly: 17,
    darkVessels: 3,
    crossMatchRate: 0.94,
    boundingIou: 0.81,
    headingAgreement: 0.86,
  },
  {
    portCode: "INNSA",
    sceneId: "S1A_IW_20261108T002905",
    timestamp: "08:36:10Z",
    vesselDetections: 71,
    anchorageCount: 28,
    changeScore: 0.38,
    confidence: 0.83,
    aisActive: 58,
    sarOnly: 13,
    darkVessels: 2,
    crossMatchRate: 0.91,
    boundingIou: 0.78,
    headingAgreement: 0.84,
  },
];
