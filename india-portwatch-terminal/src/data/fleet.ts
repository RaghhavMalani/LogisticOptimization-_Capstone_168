import type { FleetVessel } from "@/types/portwatch";

export const fleetVessels: FleetVessel[] = [
  { imo: "9481234", name: "MV KAVERI STAR", vesselType: "CONT", destinationPortCode: "INMAA", eta: "T+38h", waitRisk: 0.82, entryRisk: 0.71, bestArrival: "T+72h", worstArrival: "T+30h", buffer: "+34h", confidence: 0.88 },
  { imo: "9502881", name: "MV BHARAT PRIDE", vesselType: "BULK", destinationPortCode: "INPRT", eta: "T+18h", waitRisk: 0.44, entryRisk: 0.38, bestArrival: "T+22h", worstArrival: "T+50h", buffer: "+6h", confidence: 0.79 },
  { imo: "9611203", name: "MT ARABIAN DAWN", vesselType: "TANKER", destinationPortCode: "INBOM", eta: "T+26h", waitRisk: 0.77, entryRisk: 0.66, bestArrival: "T+58h", worstArrival: "T+22h", buffer: "+30h", confidence: 0.86 },
  { imo: "9723448", name: "MV DECCAN EAGLE", vesselType: "CONT", destinationPortCode: "INNSA", eta: "T+12h", waitRisk: 0.73, entryRisk: 0.68, bestArrival: "T+44h", worstArrival: "T+10h", buffer: "+28h", confidence: 0.85 },
  { imo: "9814009", name: "MT GULF STARLIGHT", vesselType: "TANKER", destinationPortCode: "INVTZ", eta: "T+44h", waitRisk: 0.52, entryRisk: 0.41, bestArrival: "T+44h", worstArrival: "T+70h", buffer: "+0h", confidence: 0.81 },
  { imo: "9905712", name: "MV BENGAL FRONT", vesselType: "BULK", destinationPortCode: "INHAL", eta: "T+30h", waitRisk: 0.58, entryRisk: 0.49, bestArrival: "T+48h", worstArrival: "T+28h", buffer: "+18h", confidence: 0.8 },
  { imo: "9770122", name: "MV CORAL MERIDIAN", vesselType: "CONT", destinationPortCode: "INCOK", eta: "T+20h", waitRisk: 0.48, entryRisk: 0.36, bestArrival: "T+20h", worstArrival: "T+55h", buffer: "+0h", confidence: 0.83 },
  { imo: "9668401", name: "MT SINDHU HORIZON", vesselType: "LNG", destinationPortCode: "INIXY", eta: "T+34h", waitRisk: 0.55, entryRisk: 0.47, bestArrival: "T+52h", worstArrival: "T+32h", buffer: "+18h", confidence: 0.82 },
];
