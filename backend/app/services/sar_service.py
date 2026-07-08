from backend.app.services.port_service import get_port

VESSELS = [
  {"id": "MMSI-419000000", "vesselType": "CONT", "lat": 22.32, "lon": 69.42, "heading": 40, "speedKnots": 8, "flag": "IN", "source": "SAR", "confidence": 0.72},
  {"id": "MMSI-419000137", "vesselType": "TANKER", "lat": 22.18, "lon": 70.05, "heading": 55, "speedKnots": 9, "flag": "SG", "source": "AIS", "confidence": 0.75},
  {"id": "MMSI-419000274", "vesselType": "CONT", "lat": 18.62, "lon": 72.53, "heading": 90, "speedKnots": 10, "flag": "PA", "source": "AIS", "confidence": 0.78},
  {"id": "MMSI-419000411", "vesselType": "OTHER", "lat": 18.42, "lon": 72.88, "heading": 110, "speedKnots": 11, "flag": "LR", "source": "AIS_SAR", "confidence": 0.81},
  {"id": "MMSI-419000548", "vesselType": "CONT", "lat": 13.54, "lon": 80.72, "heading": 320, "speedKnots": 12, "flag": "MH", "source": "AIS", "confidence": 0.84},
  {"id": "MMSI-419000685", "vesselType": "TANKER", "lat": 17.34, "lon": 83.54, "heading": 10, "speedKnots": 13, "flag": "AE", "source": "AIS", "confidence": 0.87},
  {"id": "MMSI-419000822", "vesselType": "CONT", "lat": 20.04, "lon": 86.34, "heading": 100, "speedKnots": 14, "flag": "IN", "source": "SAR", "confidence": 0.9},
]


def list_vessels() -> list[dict]:
  return [{**vessel, "location": {"lat": vessel["lat"], "lon": vessel["lon"]}} for vessel in VESSELS]


def get_sar_signal(port_id: str) -> dict:
  port = get_port(port_id)
  east = port["coast"] == "east"
  detections = 63 if port["code"] == "INMAA" else 52 if east else 46
  sar_only = 17 if port["code"] == "INMAA" else 9
  return {
    "portCode": port["code"],
    "sceneId": f"S1A_IW_20260708_{port['short']}",
    "timestamp": "08:42:00Z",
    "vesselDetections": detections,
    "anchorageCount": round(detections * 0.35),
    "changeScore": 0.42 if east else 0.31,
    "confidence": 0.79 if east else 0.83,
    "aisActive": detections - sar_only,
    "sarOnly": sar_only,
    "darkVessels": 3 if east else 2,
    "crossMatchRate": 0.92,
    "boundingIou": 0.8,
    "headingAgreement": 0.85,
    "source": "SAR_AIS_PROXY_DEMO",
  }
