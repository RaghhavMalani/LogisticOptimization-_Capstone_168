from fastapi import APIRouter

from backend.app.services.scenario_service import list_scenarios, simulate

router = APIRouter(prefix="/api/scenarios", tags=["scenarios"])


@router.get("")
def scenarios() -> list[dict]:
  return list_scenarios()


@router.post("/simulate")
def simulate_scenario(payload: dict) -> dict:
  return simulate(payload)
