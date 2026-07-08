from backend.app.services.sar_service import get_sar_signal


def score_sar(port_id: str) -> dict:
  sar = get_sar_signal(port_id)
  queue_pressure = min(1.0, sar["anchorageCount"] / 32)
  return {
    "module": "SAR/AIS Proxy Expert",
    "inputSignal": "SAR detections + AIS queue",
    "score": round(queue_pressure, 3),
    "confidence": sar["confidence"],
    "effectOnForecast": round(queue_pressure * 0.16, 3),
    "timestamp": sar["timestamp"],
  }
