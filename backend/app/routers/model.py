from fastapi import APIRouter

from backend.app.engines.decision_engine import recommend
from backend.app.engines.forecast_engine import run_forecast
from backend.app.engines.hsmm_engine import infer_regime
from backend.app.services.model_service import pipeline_status

router = APIRouter(prefix="/api/model", tags=["model"])


@router.get("/pipeline")
def pipeline() -> list[dict]:
  return pipeline_status()


@router.get("/{port_id}/regime")
def regime(port_id: str) -> dict:
  return infer_regime(port_id)


@router.get("/{port_id}/forecast")
def forecast(port_id: str) -> list[dict]:
  return run_forecast(port_id)


@router.get("/{port_id}/decision")
def decision(port_id: str) -> dict:
  return recommend(port_id)
