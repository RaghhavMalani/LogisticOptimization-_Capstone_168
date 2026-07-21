from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()


EVENTS = [
    {
        "id": "NEWS-001",
        "timestamp": "08:41",
        "source": "PortWatch AI",
        "tag": "CHENNAI",
        "entity": "CHENNAI",
        "severity": "elevated",
        "sentiment": -0.24,
        "text": "Monsoon-linked wind and rainfall signals may affect pilotage windows near Chennai.",
        "affectedPorts": ["INMAA"],
        "confidence": 0.82,
    },
    {
        "id": "NEWS-002",
        "timestamp": "08:31",
        "source": "PortWatch AI",
        "tag": "JNPT",
        "entity": "JNPT",
        "severity": "watch",
        "sentiment": -0.18,
        "text": "Container yard utilization remains elevated but manageable at JNPT.",
        "affectedPorts": ["INNSA"],
        "confidence": 0.78,
    },
    {
        "id": "NEWS-003",
        "timestamp": "08:20",
        "source": "PortWatch AI",
        "tag": "MUNDRA",
        "entity": "MUNDRA",
        "severity": "normal",
        "sentiment": 0.05,
        "text": "Demand pressure steady with moderate export flow at Mundra.",
        "affectedPorts": ["INMUN"],
        "confidence": 0.76,
    },
    {
        "id": "NEWS-004",
        "timestamp": "08:12",
        "source": "PortWatch AI",
        "tag": "HORMUZ",
        "entity": "HORMUZ",
        "severity": "elevated",
        "sentiment": -0.31,
        "text": "Tanker rerouting risk remains elevated near Strait of Hormuz.",
        "affectedPorts": ["INMUN", "INNSA"],
        "confidence": 0.80,
    },
]


ALERTS = [
    {
        "id": "AL-001",
        "portCode": "INMAA",
        "severity": "severe",
        "text": "Berth queue > 22h; recommend ETA shift +36h",
        "ts": "08:44",
    },
    {
        "id": "AL-002",
        "portCode": "INNSA",
        "severity": "severe",
        "text": "Container yard utilization elevated; monitor gate flow",
        "ts": "08:31",
    },
    {
        "id": "AL-003",
        "portCode": "INMUN",
        "severity": "watch",
        "text": "Weather window may affect pilotage schedule",
        "ts": "08:20",
    },
]


@router.get("/news")
def news_bundle() -> dict:
    return {
        "events": EVENTS,
        "alerts": ALERTS,
        "summary": {
            "totalEvents": len(EVENTS),
            "totalAlerts": len(ALERTS),
            "negativeEvents": sum(1 for e in EVENTS if e["sentiment"] < 0),
            "averageConfidence": round(
                sum(e["confidence"] for e in EVENTS) / len(EVENTS), 3
            ),
        },
    }


@router.get("/news/entity/{entity}")
def news_for_entity(entity: str) -> dict:
    entity_lower = entity.lower()

    matches = [
        e
        for e in EVENTS
        if entity_lower in e["entity"].lower()
        or entity_lower in e["text"].lower()
        or any(entity_lower in p.lower() for p in e["affectedPorts"])
    ]

    return {
        "events": matches,
        "alerts": [
            alert
            for alert in ALERTS
            if entity_lower in alert["portCode"].lower()
            or entity_lower in alert["text"].lower()
        ],
    }
