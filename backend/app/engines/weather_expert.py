from backend.app.services.weather_service import get_weather


def score_weather(port_id: str) -> dict:
  weather = get_weather(port_id)
  effect = weather["impactScore"] * 0.28
  return {
    "module": "Weather Expert",
    "inputSignal": "wind/wave/rain/cyclone",
    "score": weather["impactScore"],
    "confidence": weather["persistenceScore"],
    "effectOnForecast": round(effect, 3),
    "timestamp": weather["timestamp"],
  }
