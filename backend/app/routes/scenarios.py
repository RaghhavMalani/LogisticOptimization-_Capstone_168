from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()


SCENARIOS = [
    {
        "id": "STORM_W",
        "name": "Storm near west coast",
        "description": "Severe monsoon storm tracking along Arabian Sea.",
        "severity": 0.85,
        "affectedPorts": ["INNSA", "INMUN", "INCOK"],
    },
    {
        "id": "CYCLONE_E",
        "name": "Cyclone near east coast",
        "description": "Bay of Bengal cyclone approaching Chennai-Vizag corridor.",
        "severity": 0.90,
        "affectedPorts": ["INMAA", "INVTZ", "INKAT"],
    },
    {
        "id": "HORMUZ",
        "name": "Hormuz closure",
        "description": "Strait of Hormuz closure affecting Gulf crude/LNG traffic.",
        "severity": 0.90,
        "affectedPorts": ["INMUN", "INNSA", "INCOK"],
    },
    {
        "id": "RED_SEA",
        "name": "Red Sea disruption",
        "description": "Bab-el-Mandeb/Suez route disruption.",
        "severity": 0.80,
        "affectedPorts": ["INNSA", "INMUN", "INCOK"],
    },
    {
        "id": "DEMAND_SURGE",
        "name": "Demand surge",
        "description": "Festival or quarter-end cargo demand surge.",
        "severity": 0.60,
        "affectedPorts": ["INNSA", "INMUN", "INMAA", "INVTZ"],
    },
]


PORT_NAMES = {
    "INNSA": "JNPT / Nhava Sheva",
    "INMUN": "Mundra",
    "INCOK": "Cochin",
    "INMAA": "Chennai",
    "INVTZ": "Visakhapatnam",
    "INKAT": "Kattupalli",
}


@router.get("/scenarios")
def list_scenarios() -> list[dict]:
    return SCENARIOS


@router.post("/scenarios/simulate")
def simulate_scenario(payload: dict) -> dict:
    scenario_id = (
        payload.get("scenarioId")
        or payload.get("id")
        or payload.get("scenario")
        or "STORM_W"
    )

    intensity = float(
        payload.get("intensity")
        or payload.get("scenarioIntensity")
        or payload.get("multiplier")
        or 1.0
    )

    scenario = next((s for s in SCENARIOS if s["id"] == scenario_id), None)

    if scenario is None:
        scenario = {
            "id": scenario_id,
            "name": "Custom Scenario",
            "description": "Custom user-defined scenario.",
            "severity": 0.60,
            "affectedPorts": ["INNSA", "INMAA"],
        }

    severity = float(scenario.get("severity", 0.6))
    scaled = max(0.1, min(severity * intensity, 2.0))

    congestion_increase_pct = round(30.0 * scaled, 1)
    delay_increase_hours = round(7.0 * scaled, 1)
    throughput_drop_pct = round(15.0 * scaled, 1)
    freight_impact_pct = round(5.5 * scaled, 1)

    affected_ports = []
    for index, code in enumerate(scenario.get("affectedPorts", []), start=1):
        score = int(max(35, min(99, congestion_increase_pct * 1.9 - index * 2)))
        risk = "SEVERE" if score >= 75 else "HIGH" if score >= 55 else "MEDIUM"

        affected_ports.append(
            {
                "rank": index,
                "portCode": code,
                "code": code,
                "name": PORT_NAMES.get(code, code),
                "impactScore": score,
                "score": score,
                "severity": risk,
                "risk": risk,
                "delayHours": round(delay_increase_hours * (1 - index * 0.04), 1),
                "congestionIncreasePct": congestion_increase_pct,
            }
        )

    affected_chokepoints = [
        {
            "name": "Strait of Hormuz",
            "risk": "MEDIUM" if scenario["id"] == "HORMUZ" else "WATCH",
            "riskLevel": "MEDIUM" if scenario["id"] == "HORMUZ" else "WATCH",
            "delayHours": round(delay_increase_hours * 0.8, 1),
        },
        {
            "name": "Bab-el-Mandeb",
            "risk": "MEDIUM" if scenario["id"] in {"RED_SEA", "HORMUZ"} else "WATCH",
            "riskLevel": "MEDIUM" if scenario["id"] in {"RED_SEA", "HORMUZ"} else "WATCH",
            "delayHours": round(delay_increase_hours * 0.6, 1),
        },
        {
            "name": "Malacca Strait",
            "risk": "LOW",
            "riskLevel": "LOW",
            "delayHours": round(delay_increase_hours * 0.3, 1),
        },
        {
            "name": "Suez Canal",
            "risk": "WATCH" if scenario["id"] == "RED_SEA" else "LOW",
            "riskLevel": "WATCH" if scenario["id"] == "RED_SEA" else "LOW",
            "delayHours": round(delay_increase_hours * 0.5, 1),
        },
    ]

    route_impacts = [
        {
            "name": "West Coast Route",
            "route": "West Coast Route",
            "delayHours": round(delay_increase_hours * 0.8, 1),
            "impact": "HIGH" if scaled > 1.0 else "MEDIUM",
        },
        {
            "name": "East Coast Route",
            "route": "East Coast Route",
            "delayHours": round(delay_increase_hours * 0.6, 1),
            "impact": "HIGH" if scenario["id"] in {"CYCLONE_E", "STORM_W"} else "MEDIUM",
        },
    ]

    recommendations = [
        "Move discretionary east-coast calls to later tide windows.",
        "Stagger inbound ETA by 24-48h for high-risk vessels.",
        "Reserve yard capacity for priority cargo classes.",
        "Push updated delay guidance to fleet operators.",
    ]

    metrics = {
        "congestionIncreasePct": congestion_increase_pct,
        "congestionIncrease": congestion_increase_pct,
        "delayIncreaseHours": delay_increase_hours,
        "delayIncrease": delay_increase_hours,
        "throughputDropPct": throughput_drop_pct,
        "throughputDrop": throughput_drop_pct,
        "freightImpactPct": freight_impact_pct,
        "freightImpact": freight_impact_pct,
    }

    return {
        "scenarioId": scenario["id"],
        "id": scenario["id"],
        "name": scenario["name"],
        "status": "simulated",
        "summary": f"{scenario['name']} simulated at {intensity:.1f}x intensity.",

        "congestionIncreasePct": congestion_increase_pct,
        "congestionIncrease": congestion_increase_pct,
        "delayIncreaseHours": delay_increase_hours,
        "delayIncrease": delay_increase_hours,
        "throughputDropPct": throughput_drop_pct,
        "throughputDrop": throughput_drop_pct,
        "freightImpactPct": freight_impact_pct,
        "freightImpact": freight_impact_pct,

        "metrics": metrics,
        "impact": metrics,

        "affectedPorts": affected_ports,
        "affectedChokepoints": affected_chokepoints,
        "routeImpacts": route_impacts,
        "seaRouteImpact": route_impacts,

        "recommendedResponse": recommendations,
        "recommendedOperationalResponse": recommendations,
        "recommendations": recommendations,
    }
