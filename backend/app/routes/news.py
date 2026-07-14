from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()


EVENTS = [
    {
        "id": "NEWS-001",
        "timestamp": "08:41",
        "source": "PortWatch AI",
        "tag": "Weather",
        "entity": "Chennai",
        "severity": "elevated",
        "sentiment": -0.24,
        "text": "Monsoon-linked wind and rainfall signals may affect pilotage windows.",
        "affectedPorts": ["INMAA"],
        "confidence": 0.82,
    },
    {
        "id": "NEWS-002",
        "timestamp": "08:31",
        "source": "PortWatch AI",
        "tag": "Congestion",
        "entity": "JNPT",
        "severity": "watch",
        "sentiment": -0.18,
        "text": "Container yard utilization remains elevated but manageable.",
        "affectedPorts": ["INNSA"],
        "confidence": 0.78,
    },
    {
        "id": "NEWS-003",
        "timestamp": "08:20",
        "source": "PortWatch AI",
        "tag": "Demand",
        "entity": "Mundra",
        "severity": "watch",
        "sentiment": 0.05,
        "text": "Demand pressure steady with moderate export flow.",
        "affectedPorts": ["INMUN"],
        "confidence": 0.76,
    },
]


@router.get("/news")
def news_bundle() -> dict:
    return {
        "events": EVENTS,
        "summary": {
            "totalEvents": len(EVENTS),
            "negativeEvents": sum(1 for e in EVENTS if e["sentiment"] < 0),
            "averageConfidence": round(sum(e["confidence"] for e in EVENTS) / len(EVENTS), 3),
        },
    }


@router.get("/news/entity/{entity}")
def news_for_entity(entity: str) -> dict:
    entity_lower = entity.lower()

    matches = [
        e for e in EVENTS
        if entity_lower in e["entity"].lower()
        or entity_lower in e["text"].lower()
        or any(entity_lower in p.lower() for p in e["affectedPorts"])
    ]

    return {
        "events": matches,
    }