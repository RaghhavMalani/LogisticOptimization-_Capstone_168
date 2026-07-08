from backend.app.services.port_service import get_port_snapshot


def score_demand(port_id: str) -> dict:
  port = get_port_snapshot(port_id)
  demand_pressure = min(1.0, port["throughput"] / 220)
  return {
    "module": "Demand Expert",
    "inputSignal": "throughput/import/export trend",
    "score": round(demand_pressure, 3),
    "confidence": 0.81,
    "effectOnForecast": round(demand_pressure * 0.08, 3),
    "timestamp": port["updatedAt"],
  }
