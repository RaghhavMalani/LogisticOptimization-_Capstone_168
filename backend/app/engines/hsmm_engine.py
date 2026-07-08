from backend.app.engines.feature_engine import build_feature_vector
from backend.app.services.model_service import latest_regime


def infer_regime(port_id: str) -> dict:
  vector = build_feature_vector(port_id)
  regime = latest_regime(port_id)
  stress = vector["congestion"] * 0.45 + vector["weatherImpact"] * 0.25 + vector["sarQueuePressure"] * 0.2 + vector["newsPressure"] * 0.1
  return {
    **regime,
    "stressScore": round(stress, 3),
    "engine": "HSMM_ENGINE_DEMO",
  }
