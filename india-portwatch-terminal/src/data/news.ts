import type { NewsEvent } from "@/types/portwatch";

export const newsEvents: NewsEvent[] = [
  { id: "NW-0841-HRMZ", timestamp: "08:41", source: "Reuters", tag: "HORMUZ", entity: "HORMUZ", severity: "elevated", sentiment: -0.42, text: "Tanker rerouting continues near Strait of Hormuz; premiums up 4.2%.", affectedPorts: ["INMUN", "INIXY", "INBOM", "INNSA", "INCOK"], confidence: 0.91 },
  { id: "NW-0828-MAA", timestamp: "08:28", source: "Splash247", tag: "CHENNAI", entity: "CHENNAI", severity: "severe", sentiment: -0.28, text: "Chennai berth 4 dredging delay extends anchorage queue to 24h.", affectedPorts: ["INMAA", "INENR"], confidence: 0.87 },
  { id: "NW-0812-BAB", timestamp: "08:12", source: "gCaptain", tag: "RED SEA", entity: "RED SEA", severity: "watch", sentiment: -0.36, text: "Two additional carriers pause Red Sea transits through Bab-el-Mandeb.", affectedPorts: ["INMUN", "INNSA", "INCOK"], confidence: 0.84 },
  { id: "NW-0755-BAY", timestamp: "07:55", source: "IMD", tag: "BAY", entity: "BAY OF BENGAL", severity: "watch", sentiment: -0.22, text: "Low-pressure system intensifying over south-east Bay of Bengal.", affectedPorts: ["INMAA", "INENR", "INVTZ", "INPRT"], confidence: 0.89 },
  { id: "NW-0739-BOM", timestamp: "07:39", source: "Bloomberg", tag: "MUMBAI", entity: "MUMBAI", severity: "watch", sentiment: -0.14, text: "JNPT throughput slips 6% W/W amid labour rotation and monsoon swell.", affectedPorts: ["INBOM", "INNSA"], confidence: 0.83 },
  { id: "NW-0720-MUN", timestamp: "07:20", source: "PortNews", tag: "MUNDRA", entity: "MUNDRA", severity: "normal", sentiment: 0.08, text: "Mundra resumes normal ops after fog window at 05:40 UTC.", affectedPorts: ["INMUN"], confidence: 0.78 },
];

export const alertEvents = [
  { id: "AL-2041", portCode: "INMAA", severity: "severe", text: "Berth queue > 22h; recommend ETA shift +36h", ts: "08:44" },
  { id: "AL-2039", portCode: "INBOM", severity: "severe", text: "Congestion 0.83 - HSMM regime CONGESTED_HIGH", ts: "08:31" },
  { id: "AL-2036", portCode: "INNSA", severity: "severe", text: "Yard utilisation 94% - reroute cont. traffic", ts: "08:22" },
  { id: "AL-2033", portCode: "INHAL", severity: "watch", text: "River pilotage window narrowing (tide)", ts: "08:10" },
  { id: "AL-2029", portCode: "INPRT", severity: "watch", text: "SAR confidence 0.52 - cloud cover 88%", ts: "07:52" },
  { id: "AL-2025", portCode: "INVTZ", severity: "watch", text: "Cyclogenesis probability 34% (T+72h)", ts: "07:31" },
] as const;

export const entitySentiment = [
  { entity: "HORMUZ", mentions: 42, sentiment: -0.42 },
  { entity: "RED SEA", mentions: 31, sentiment: -0.36 },
  { entity: "CHENNAI", mentions: 24, sentiment: -0.28 },
  { entity: "MUMBAI", mentions: 19, sentiment: -0.14 },
  { entity: "MUNDRA", mentions: 12, sentiment: 0.08 },
  { entity: "SUEZ", mentions: 8, sentiment: -0.06 },
  { entity: "MALACCA", mentions: 6, sentiment: 0.02 },
];
