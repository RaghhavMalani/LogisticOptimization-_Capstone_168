export type Risk = "normal" | "congested" | "severe" | "lowconf";

export interface Port {
  code: string;
  name: string;
  short: string;
  lat: number;
  lon: number;
  x: number; // 0..1000 on map
  y: number; // 0..1000 on map
  risk: Risk;
  congestion: number; // 0..1
  delayHours: number;
  throughput: number;
  vessels: number;
  confidence: number;
  coast: "west" | "east";
}

// x,y are pre-projected coordinates on a 1000x1000 map viewport of India
export const PORTS: Port[] = [
  { code: "INMUN", name: "Mundra", short: "MUN", lat: 22.74, lon: 69.70, x: 210, y: 340, risk: "congested", congestion: 0.62, delayHours: 14, throughput: 178, vessels: 82, confidence: 0.88, coast: "west" },
  { code: "INIXY", name: "Deendayal / Kandla", short: "KDL", lat: 23.02, lon: 70.22, x: 235, y: 320, risk: "congested", congestion: 0.58, delayHours: 12, throughput: 141, vessels: 61, confidence: 0.84, coast: "west" },
  { code: "INBOM", name: "Mumbai", short: "BOM", lat: 18.95, lon: 72.83, x: 295, y: 470, risk: "severe", congestion: 0.83, delayHours: 22, throughput: 96, vessels: 54, confidence: 0.91, coast: "west" },
  { code: "INNSA", name: "JNPT / Nhava Sheva", short: "JNP", lat: 18.95, lon: 72.95, x: 305, y: 482, risk: "severe", congestion: 0.79, delayHours: 19, throughput: 208, vessels: 71, confidence: 0.93, coast: "west" },
  { code: "INMRM", name: "Mormugao", short: "MRM", lat: 15.41, lon: 73.80, x: 335, y: 570, risk: "normal", congestion: 0.34, delayHours: 6, throughput: 44, vessels: 22, confidence: 0.82, coast: "west" },
  { code: "ININM", name: "New Mangalore", short: "NML", lat: 12.92, lon: 74.80, x: 355, y: 635, risk: "normal", congestion: 0.28, delayHours: 5, throughput: 41, vessels: 19, confidence: 0.79, coast: "west" },
  { code: "INCOK", name: "Cochin", short: "COK", lat: 9.96, lon: 76.24, x: 400, y: 720, risk: "congested", congestion: 0.55, delayHours: 11, throughput: 63, vessels: 34, confidence: 0.85, coast: "west" },
  { code: "INTUT", name: "Tuticorin (V.O.C.)", short: "TUT", lat: 8.79, lon: 78.13, x: 465, y: 762, risk: "normal", congestion: 0.31, delayHours: 6, throughput: 38, vessels: 18, confidence: 0.80, coast: "east" },
  { code: "INMAA", name: "Chennai", short: "MAA", lat: 13.08, lon: 80.29, x: 545, y: 635, risk: "severe", congestion: 0.86, delayHours: 24, throughput: 152, vessels: 68, confidence: 0.94, coast: "east" },
  { code: "INENR", name: "Kamarajar / Ennore", short: "ENR", lat: 13.25, lon: 80.33, x: 552, y: 628, risk: "congested", congestion: 0.61, delayHours: 13, throughput: 88, vessels: 41, confidence: 0.87, coast: "east" },
  { code: "INVTZ", name: "Visakhapatnam", short: "VTZ", lat: 17.68, lon: 83.21, x: 610, y: 500, risk: "congested", congestion: 0.57, delayHours: 12, throughput: 121, vessels: 49, confidence: 0.86, coast: "east" },
  { code: "INPRT", name: "Paradip", short: "PRT", lat: 20.26, lon: 86.67, x: 675, y: 425, risk: "lowconf", congestion: 0.48, delayHours: 9, throughput: 104, vessels: 37, confidence: 0.52, coast: "east" },
  { code: "INHAL", name: "Haldia / Kolkata", short: "HAL", lat: 22.03, lon: 88.06, x: 720, y: 370, risk: "congested", congestion: 0.60, delayHours: 13, throughput: 87, vessels: 40, confidence: 0.83, coast: "east" },
];

export const CHOKEPOINTS = [
  { code: "HRMZ", name: "HORMUZ", x: -40, y: 260, status: "elevated" as const },
  { code: "BAB",  name: "BAB-EL-MANDEB", x: -80, y: 640, status: "watch" as const },
  { code: "SUEZ", name: "SUEZ", x: -120, y: 100, status: "normal" as const },
  { code: "MLC",  name: "MALACCA", x: 1080, y: 720, status: "normal" as const },
];

export const ROUTES: { from: string; to: string; label: string; risk: "normal"|"watch"|"elevated" }[] = [
  { from: "INNSA", to: "HRMZ", label: "IN → Hormuz",    risk: "elevated" },
  { from: "INMUN", to: "SUEZ", label: "IN → Suez",      risk: "watch" },
  { from: "INCOK", to: "BAB",  label: "IN → Bab-el-Mandeb", risk: "watch" },
  { from: "INMAA", to: "MLC",  label: "IN → Malacca",   risk: "normal" },
  { from: "INVTZ", to: "MLC",  label: "VTZ → Malacca",  risk: "normal" },
];

export const RISK_COLOR: Record<Risk, string> = {
  normal: "var(--color-mint)",
  congested: "var(--color-amber)",
  severe: "var(--color-red)",
  lowconf: "var(--color-purple)",
};

export const RISK_LABEL: Record<Risk, string> = {
  normal: "NORMAL",
  congested: "CONGESTED",
  severe: "SEVERE",
  lowconf: "LOW CONF",
};

export interface Vessel {
  id: string;
  type: "TANKER" | "BULK" | "CONT" | "LNG";
  x: number; y: number;
  heading: number; // degrees
  speed: number;
  flag: string;
}

// Generate stable vessel positions across the maritime map
export const VESSELS: Vessel[] = (() => {
  const seed = [
    [280, 380, 45, "TANKER"], [250, 420, 30, "BULK"], [190, 500, 90, "CONT"],
    [320, 520, 180, "TANKER"], [340, 590, 200, "CONT"], [380, 660, 210, "BULK"],
    [430, 740, 260, "LNG"], [480, 720, 300, "CONT"], [520, 660, 330, "TANKER"],
    [560, 590, 340, "CONT"], [600, 540, 350, "BULK"], [640, 470, 20, "TANKER"],
    [680, 400, 40, "CONT"], [730, 350, 60, "LNG"], [750, 300, 80, "BULK"],
    [155, 380, 260, "TANKER"], [120, 460, 250, "BULK"], [90, 540, 240, "CONT"],
    [800, 460, 100, "LNG"], [850, 550, 120, "CONT"], [900, 640, 140, "TANKER"],
    [180, 250, 200, "BULK"], [400, 800, 320, "CONT"], [600, 800, 300, "LNG"],
    [280, 250, 20, "TANKER"], [500, 460, 90, "CONT"], [700, 550, 60, "BULK"],
  ];
  return seed.map(([x, y, h, t], i) => ({
    id: `MMSI-${419000000 + i * 137}`,
    type: t as Vessel["type"],
    x: x as number, y: y as number, heading: h as number,
    speed: 8 + (i % 12),
    flag: ["IN", "SG", "PA", "LR", "MH", "AE"][i % 6],
  }));
})();

export const NLP_HEADLINES = [
  { t: "08:41", src: "Reuters",   tag: "HORMUZ", sev: "elevated", text: "Tanker rerouting continues near Strait of Hormuz; premiums up 4.2%." },
  { t: "08:28", src: "Splash247", tag: "CHENNAI", sev: "severe",  text: "Chennai berth 4 dredging delay extends anchorage queue to 24h." },
  { t: "08:12", src: "gCaptain",  tag: "RED SEA", sev: "watch",   text: "Two additional carriers pause Red Sea transits through Bab-el-Mandeb." },
  { t: "07:55", src: "IMD",       tag: "BAY",    sev: "watch",    text: "Low-pressure system intensifying over south-east Bay of Bengal." },
  { t: "07:39", src: "Bloomberg", tag: "MUMBAI", sev: "watch",    text: "JNPT throughput slips 6% W/W amid labour rotation and monsoon swell." },
  { t: "07:20", src: "PortNews",  tag: "MUNDRA", sev: "normal",   text: "Mundra resumes normal ops after fog window at 05:40 UTC." },
];

export const ALERTS = [
  { id: "AL-2041", port: "MAA", sev: "severe", text: "Berth queue > 22h; recommend ETA shift +36h", ts: "08:44" },
  { id: "AL-2039", port: "BOM", sev: "severe", text: "Congestion 0.83 — HSMM regime CONGESTED_HIGH", ts: "08:31" },
  { id: "AL-2036", port: "JNP", sev: "severe", text: "Yard utilisation 94% — reroute cont. traffic",  ts: "08:22" },
  { id: "AL-2033", port: "HAL", sev: "watch",  text: "River pilotage window narrowing (tide)",         ts: "08:10" },
  { id: "AL-2029", port: "PRT", sev: "watch",  text: "SAR confidence 0.52 — cloud cover 88%",         ts: "07:52" },
  { id: "AL-2025", port: "VTZ", sev: "watch",  text: "Cyclogenesis probability 34% (T+72h)",          ts: "07:31" },
];

export const PIPELINE = [
  { key: "WX",   name: "Weather Expert",       score: 0.71, conf: 0.88, note: "Bay-of-Bengal LPA intensifying" },
  { key: "NLP",  name: "News / NLP Expert",    score: 0.63, conf: 0.82, note: "Hormuz sentiment −0.42" },
  { key: "SAR",  name: "SAR / AIS Proxy",      score: 0.58, conf: 0.79, note: "Anchorage +14 vs baseline" },
  { key: "DEM",  name: "Demand Expert",        score: 0.44, conf: 0.85, note: "Container demand steady" },
  { key: "HSMM", name: "HSMM Regime",          score: 0.77, conf: 0.90, note: "Regime: CONGESTED_HIGH" },
  { key: "TFT",  name: "TFT Forecast (10d)",   score: 0.69, conf: 0.87, note: "Peak T+3 → T+5" },
  { key: "DEC",  name: "Decision Layer",       score: 0.74, conf: 0.86, note: "Reroute + buffer +36h" },
];

export const SCENARIOS = [
  { key: "STORM_W",  name: "Storm — West Coast",     desc: "Deep depression over Arabian Sea"       },
  { key: "CYC_E",    name: "Cyclone — East Coast",   desc: "Category-2 landfall near Kakinada"      },
  { key: "LABOUR",   name: "Labour Strike",          desc: "48h port workers strike Mumbai/JNPT"    },
  { key: "CAPDROP",  name: "Port Capacity Drop",     desc: "Berth 3–5 Chennai offline 72h"          },
  { key: "DEMAND",   name: "Demand Surge",           desc: "+22% container demand pre-festival"     },
  { key: "HORMUZ",   name: "Hormuz Closure",         desc: "Full closure 7 days"                    },
  { key: "REDSEA",   name: "Red Sea Disruption",     desc: "Extended Cape-of-Good-Hope routing"     },
  { key: "FUEL",     name: "Fuel Price Shock",       desc: "VLSFO +34% w/w"                         },
];

export const FLEET = [
  { imo: "9481234", name: "MV KAVERI STAR",   type: "CONT",   destPort: "MAA", eta: "T+38h", waitRisk: 0.82, entryRisk: 0.71, best: "T+72h", worst: "T+30h", buffer: "+34h", conf: 0.88 },
  { imo: "9502881", name: "MV BHARAT PRIDE",  type: "BULK",   destPort: "PRT", eta: "T+18h", waitRisk: 0.44, entryRisk: 0.38, best: "T+22h", worst: "T+50h", buffer: "+6h",  conf: 0.79 },
  { imo: "9611203", name: "MT ARABIAN DAWN",  type: "TANKER", destPort: "BOM", eta: "T+26h", waitRisk: 0.77, entryRisk: 0.66, best: "T+58h", worst: "T+22h", buffer: "+30h", conf: 0.86 },
  { imo: "9723448", name: "MV DECCAN EAGLE",  type: "CONT",   destPort: "JNP", eta: "T+12h", waitRisk: 0.73, entryRisk: 0.68, best: "T+44h", worst: "T+10h", buffer: "+28h", conf: 0.85 },
  { imo: "9814009", name: "MT GULF STARLIGHT",type: "TANKER", destPort: "VTZ", eta: "T+44h", waitRisk: 0.52, entryRisk: 0.41, best: "T+44h", worst: "T+70h", buffer: "+0h",  conf: 0.81 },
  { imo: "9905712", name: "MV BENGAL FRONT",  type: "BULK",   destPort: "HAL", eta: "T+30h", waitRisk: 0.58, entryRisk: 0.49, best: "T+48h", worst: "T+28h", buffer: "+18h", conf: 0.80 },
  { imo: "9770122", name: "MV CORAL MERIDIAN",type: "CONT",   destPort: "COK", eta: "T+20h", waitRisk: 0.48, entryRisk: 0.36, best: "T+20h", worst: "T+55h", buffer: "+0h",  conf: 0.83 },
  { imo: "9668401", name: "MT SINDHU HORIZON",type: "LNG",    destPort: "KDL", eta: "T+34h", waitRisk: 0.55, entryRisk: 0.47, best: "T+52h", worst: "T+32h", buffer: "+18h", conf: 0.82 },
];

export const COMMANDS = [
  "RADAR", "PORT CHENNAI", "WX CHENNAI", "SAR CHENNAI",
  "NLP HORMUZ", "MODEL CHENNAI", "SIM CYCLONE_EAST 1.5", "FLEET",
];
