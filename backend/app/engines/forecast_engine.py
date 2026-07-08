from backend.app.engines.feature_engine import build_feature_vector
from backend.app.services.model_service import forecast


def run_forecast(port_id: str) -> list[dict]:
  vector = build_feature_vector(port_id)
  points = forecast(port_id)
  adjusted: list[dict] = []
  for point in points:
    adjustment = (vector["weatherImpact"] - 0.5) * 4 + vector["sarQueuePressure"] * 1.5
    adjusted.append({
      **point,
      "congestionIndex": round(point["congestionIndex"] + adjustment, 2),
      "featureSource": vector["source"],
    })
  return adjusted
