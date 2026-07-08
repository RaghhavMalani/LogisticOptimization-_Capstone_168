from backend.app.engines.scenario_engine import scenario_definitions, simulate_scenario


def list_scenarios() -> list[dict]:
  return scenario_definitions()


def simulate(payload: dict) -> dict:
  key = str(payload.get("scenarioKey") or payload.get("scenario") or "CYC_E")
  intensity = float(payload.get("intensity", 1.5))
  run_id = int(payload.get("runId", 1247))
  return simulate_scenario(key, intensity, run_id)
