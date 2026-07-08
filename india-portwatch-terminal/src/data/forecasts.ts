import type { ModelPipelineStatus, TFTForecastPoint } from "@/types/portwatch";

export const tftForecasts: TFTForecastPoint[] = [
  { portCode: "INMAA", day: 1, dateLabel: "06 MAY", congestionIndex: 76.8, delayHoursP95: 12.6, uncertaintyBandHours: 12.6, weatherProbability: 0.93, severity: "SEVERE" },
  { portCode: "INMAA", day: 2, dateLabel: "07 MAY", congestionIndex: 78.5, delayHoursP95: 13.1, uncertaintyBandHours: 12.0, weatherProbability: 0.91, severity: "SEVERE" },
  { portCode: "INMAA", day: 3, dateLabel: "08 MAY", congestionIndex: 71.3, delayHoursP95: 10.8, uncertaintyBandHours: 9.4, weatherProbability: 0.85, severity: "HIGH" },
  { portCode: "INMAA", day: 4, dateLabel: "09 MAY", congestionIndex: 62.1, delayHoursP95: 8.8, uncertaintyBandHours: 7.1, weatherProbability: 0.75, severity: "HIGH" },
  { portCode: "INMAA", day: 5, dateLabel: "10 MAY", congestionIndex: 53.2, delayHoursP95: 7.1, uncertaintyBandHours: 5.8, weatherProbability: 0, severity: "MOD" },
  { portCode: "INMAA", day: 6, dateLabel: "11 MAY", congestionIndex: 48.7, delayHoursP95: 6.2, uncertaintyBandHours: 4.6, weatherProbability: 0, severity: "MOD" },
  { portCode: "INMAA", day: 7, dateLabel: "12 MAY", congestionIndex: 46.6, delayHoursP95: 5.8, uncertaintyBandHours: 4.2, weatherProbability: 0, severity: "MOD" },
  { portCode: "INMAA", day: 8, dateLabel: "13 MAY", congestionIndex: 44.3, delayHoursP95: 5.4, uncertaintyBandHours: 3.9, weatherProbability: 0, severity: "MOD" },
  { portCode: "INMAA", day: 9, dateLabel: "14 MAY", congestionIndex: 40.8, delayHoursP95: 4.8, uncertaintyBandHours: 3.3, weatherProbability: 0, severity: "LOW" },
  { portCode: "INMAA", day: 10, dateLabel: "15 MAY", congestionIndex: 39.1, delayHoursP95: 4.4, uncertaintyBandHours: 3.0, weatherProbability: 0, severity: "LOW" },
];

export const modelPipelineStatuses: ModelPipelineStatus[] = [
  { key: "WX", name: "Weather Expert", inputSignal: "Bay LPA; wind 28 kt; precip 14 mm/h", score: 0.71, confidence: 0.88, effectOnForecast: "+0.18 congestion at MAA/VTZ/PRT (T+48-96h)", timestamp: "08:41:03Z", modelCard: "weather-expert-v2.4" },
  { key: "NLP", name: "News/NLP Expert", inputSignal: "Hormuz sentiment -0.42; 42 mentions", score: 0.63, confidence: 0.82, effectOnForecast: "+0.11 tanker delay at BOM/JNP", timestamp: "08:41:07Z", modelCard: "nlp-tone-v1.3" },
  { key: "SAR", name: "SAR/AIS Proxy Expert", inputSignal: "S1A anchorage +14; queue expansion", score: 0.58, confidence: 0.79, effectOnForecast: "+0.14 dwell at MAA", timestamp: "08:40:58Z", modelCard: "sar-detector-v2" },
  { key: "DEM", name: "Demand Expert", inputSignal: "Container demand steady; +2%", score: 0.44, confidence: 0.85, effectOnForecast: "+0.04 base throughput", timestamp: "08:40:51Z", modelCard: "demand-nowcast-v1.8" },
  { key: "HSMM", name: "HSMM Regime", inputSignal: "Regime transition WATCH -> CONG_HIGH", score: 0.77, confidence: 0.9, effectOnForecast: "Regime prior 0.55; dwell +6h", timestamp: "08:41:11Z", modelCard: "hsmm-regime-v3.1" },
  { key: "TFT", name: "TFT Forecast", inputSignal: "Covariates fused; horizon 10d", score: 0.69, confidence: 0.87, effectOnForecast: "Peak T+72h at MAA; 34h delay", timestamp: "08:41:12Z", modelCard: "tft-fusion-v4.2" },
  { key: "DEC", name: "Decision Layer", inputSignal: "MoE weights [.18,.14,.16,.06,.24,.22]", score: 0.74, confidence: 0.86, effectOnForecast: "Recommend reroute + buffer +36h", timestamp: "08:41:12Z", modelCard: "decision-layer-v1.1" },
];

export const gatingWeights = [
  { key: "WX", value: 0.18 },
  { key: "NLP", value: 0.14 },
  { key: "SAR", value: 0.16 },
  { key: "DEM", value: 0.06 },
  { key: "HSMM", value: 0.24 },
  { key: "TFT", value: 0.22 },
];
