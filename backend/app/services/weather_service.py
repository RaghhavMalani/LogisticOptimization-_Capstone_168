from backend.app.services.port_service import get_port


def get_weather(port_id: str) -> dict:
  port = get_port(port_id)
  east = port["coast"] == "east"
  severe_bias = 0.12 if port["code"] in {"INMAA", "INVTZ", "INPRT"} else 0.0
  wind = 24 + (4 if east else -3) + (2 if port["code"] == "INMAA" else 0)
  impact = min(0.94, 0.52 + (0.14 if east else 0.04) + severe_bias)
  return {
    "portCode": port["code"],
    "timestamp": "08:45:00Z",
    "windKnots": wind,
    "gustKnots": wind + 10,
    "windDirection": "WNW" if east else "SW",
    "rainfallMm24h": 18 if east else 11,
    "precipRateMmH": 14 if east else 8,
    "waveHeightM": 1.8 if east else 2.5,
    "visibilityKm": 8.8 if east else 8.2,
    "cycloneRisk7d": 0.34 if east else 0.12,
    "seaState": "Moderate" if east else "Rough",
    "impactScore": round(impact, 2),
    "persistenceScore": round(impact - 0.09, 2),
    "shockSigma": round(max(0.1, impact - 0.4), 2),
    "advisory": "Open-Meteo connector ready; deterministic local weather signal returned.",
    "source": "LOCAL_DEMO",
  }


def list_weather() -> list[dict]:
  return [get_weather(code) for code in ["INMAA", "INVTZ", "INNSA"]]
