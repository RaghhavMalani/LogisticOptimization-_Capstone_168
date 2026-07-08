FLEET = [
  {"imo": "9876543", "name": "MV Konkan Star", "vesselType": "CONT", "destinationPortCode": "INMAA", "eta": "2026-07-09T04:20:00Z", "waitRisk": 0.74, "entryRisk": 0.68, "bestArrival": "2026-07-09T20:00:00Z", "worstArrival": "2026-07-10T18:00:00Z", "buffer": "18h", "confidence": 0.82},
  {"imo": "9876544", "name": "MT Gulf Shakti", "vesselType": "TANKER", "destinationPortCode": "INMUN", "eta": "2026-07-09T11:10:00Z", "waitRisk": 0.46, "entryRisk": 0.41, "bestArrival": "2026-07-09T18:00:00Z", "worstArrival": "2026-07-10T06:00:00Z", "buffer": "8h", "confidence": 0.78},
  {"imo": "9876545", "name": "MV Hooghly Bridge", "vesselType": "BULK", "destinationPortCode": "INHAL", "eta": "2026-07-10T03:00:00Z", "waitRisk": 0.62, "entryRisk": 0.56, "bestArrival": "2026-07-10T12:00:00Z", "worstArrival": "2026-07-11T06:00:00Z", "buffer": "12h", "confidence": 0.8},
]


def list_fleet() -> list[dict]:
  return FLEET
