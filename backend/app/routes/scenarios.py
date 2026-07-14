from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()


SCENARIOS = [
    {
        "id": "red_sea_crisis",
        "name": "Red Sea Crisis",
        "description": "Simulate route disruption and congestion uplift from Red Sea diversions.",
        "severity": 0.8,
        "affectedPorts": ["INNSA", "INMUN", "INCOK"],
    },
    {
        "id": "hormuz_closure",
        "name": "Hormuz Closure",
        "description": "Simulate tanker and energy-route disruption through the Strait of Hormuz.",
        "severity": 0.85,
        "affectedPorts": ["INMUN", "INNSA", "INCOK"],
    },
    {
        "id": "monsoon_surge",
        "name": "Monsoon Surge",
        "description": "Simulate elevated coastal weather risk across Indian ports.",
        "severity": 0.7,
        "affectedPorts": ["INMAA", "INVTZ", "INCOK"],
    },
]


@router.get("/scenarios")
def list_scenarios() -> list[dict]:
    return SCENARIOS


@router.post("/scenarios/simulate")
def simulate_scenario(payload: dict) -> dict:
    scenario_id = payload.get("scenarioId") or payload.get("id") or "custom"
    scenario = next((s for s in SCENARIOS if s["id"] == scenario_id), None)

    if scenario is None:
        scenario = {
            "id": scenario_id,
            "name": "Custom Scenario",
            "description": "Custom user-defined scenario.",
            "severity": float(payload.get("severity", 0.5)),
            "affectedPorts": payload.get("affectedPorts", []),
        }

    severity = float(scenario.get("severity", 0.5))

    return {
        "scenarioId": scenario["id"],
        "name": scenario["name"],
        "status": "simulated",
        "summary": f"{scenario['name']} simulated with severity {severity:.0%}.",
        "affectedPorts": scenario.get("affectedPorts", []),
        "impact": {
            "congestionUplift": round(12 * severity, 1),
            "delayMultiplier": round(1 + 0.5 * severity, 2),
            "throughputFactor": round(1 - 0.2 * severity, 2),
        },
        "recommendations": [
            "Review high-risk ports.",
            "Stagger arrivals for exposed ports.",
            "Increase ETA buffer for affected lanes.",
        ],
    }