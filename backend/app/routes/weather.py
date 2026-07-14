from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()


def weather_for(port_code: str) -> dict:
    port_code = port_code.upper()
    return {
        "portCode": port_code,
        "timestamp": "live",
        "windKnots": 22,
        "gustKnots": 31,
        "windDirection": "WNW",
        "rainfallMm24h": 14,
        "precipRateMmH": 2.4,
        "waveHeightM": 1.8,
        "visibilityKm": 8.5,
        "cycloneRisk7d": 0.18,
        "seaState": "Moderate",
        "impactScore": 0.62,
        "persistenceScore": 0.58,
        "shockSigma": 0.44,
        "advisory": "Monitor pilotage windows and outer anchorage conditions.",
    }


@router.get("/weather")
def weather_all() -> list[dict]:
    return [
        weather_for("INMAA"),
        weather_for("INNSA"),
        weather_for("INMUN"),
        weather_for("INCOK"),
        weather_for("INVTZ"),
    ]


@router.get("/weather/intelligence")
def weather_intelligence() -> dict:
    return {
        "monsoon": {
            "status": "ACTIVE",
            "risk": "elevated",
            "description": "Southwest monsoon conditions are active across western and eastern coastal corridors.",
        },
        "cyclone": {
            "probability72h": 0.18,
            "riskWindow": "T+48h to T+96h",
        },
        "swell": {
            "heightM": 1.8,
            "direction": "WNW",
        },
        "operationalImpact": {
            "pilotage": "restricted windows possible",
            "berthProductivity": "-12%",
            "outerAnchorage": "moderate queue pressure",
        },
    }


@router.get("/weather/{port_code}")
def weather_signal(port_code: str) -> dict:
    return weather_for(port_code)