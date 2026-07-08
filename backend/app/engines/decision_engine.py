from backend.app.engines.forecast_engine import run_forecast
from backend.app.engines.hsmm_engine import infer_regime
from backend.app.services.model_service import decision


def recommend(port_id: str) -> dict:
  base = decision(port_id)
  regime = infer_regime(port_id)
  forecast = run_forecast(port_id)
  peak = max((point["congestionIndex"] for point in forecast), default=0)
  return {
    **base,
    "peakCongestion10d": peak,
    "regimeState": regime["state"],
    "rationale": f"{base['rationale']} Peak 10-day congestion is {peak:.1f}; regime stress score is {regime['stressScore']:.2f}.",
    "engine": "DECISION_ENGINE_DEMO",
  }
