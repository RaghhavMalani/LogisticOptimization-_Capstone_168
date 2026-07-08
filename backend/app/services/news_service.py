NEWS_EVENTS = [
  {"id": "NW-0841-HRMZ", "timestamp": "08:41", "source": "Reuters", "tag": "HORMUZ", "entity": "HORMUZ", "severity": "elevated", "sentiment": -0.42, "text": "Tanker rerouting continues near Strait of Hormuz; premiums up 4.2%.", "affectedPorts": ["INMUN", "INIXY", "INBOM", "INNSA", "INCOK"], "confidence": 0.91},
  {"id": "NW-0828-MAA", "timestamp": "08:28", "source": "Splash247", "tag": "CHENNAI", "entity": "CHENNAI", "severity": "severe", "sentiment": -0.28, "text": "Chennai berth 4 dredging delay extends anchorage queue to 24h.", "affectedPorts": ["INMAA", "INENR"], "confidence": 0.87},
  {"id": "NW-0812-BAB", "timestamp": "08:12", "source": "gCaptain", "tag": "RED SEA", "entity": "RED SEA", "severity": "watch", "sentiment": -0.36, "text": "Two additional carriers pause Red Sea transits through Bab-el-Mandeb.", "affectedPorts": ["INMUN", "INNSA", "INCOK"], "confidence": 0.84},
  {"id": "NW-0755-BAY", "timestamp": "07:55", "source": "IMD", "tag": "BAY", "entity": "BAY OF BENGAL", "severity": "watch", "sentiment": -0.22, "text": "Low-pressure system intensifying over south-east Bay of Bengal.", "affectedPorts": ["INMAA", "INENR", "INVTZ", "INPRT"], "confidence": 0.89},
]

ALERTS = [
  {"id": "AL-2041", "portCode": "INMAA", "severity": "severe", "text": "Berth queue > 22h; recommend ETA shift +36h", "ts": "08:44"},
  {"id": "AL-2039", "portCode": "INBOM", "severity": "severe", "text": "Congestion 0.83 - HSMM regime CONGESTED_HIGH", "ts": "08:31"},
  {"id": "AL-2036", "portCode": "INNSA", "severity": "severe", "text": "Yard utilisation 94% - reroute container traffic", "ts": "08:22"},
  {"id": "AL-2033", "portCode": "INHAL", "severity": "watch", "text": "River pilotage window narrowing", "ts": "08:10"},
]


def list_news() -> list[dict]:
  return NEWS_EVENTS


def list_alerts() -> list[dict]:
  return ALERTS


def news_for_entity(entity: str) -> list[dict]:
  normalized = entity.strip().upper()
  focused = [event for event in NEWS_EVENTS if normalized in event["entity"] or normalized in event["tag"]]
  return focused or NEWS_EVENTS


def sentiment_summary() -> list[dict]:
  entities = {}
  for event in NEWS_EVENTS:
    current = entities.setdefault(event["entity"], {"entity": event["entity"], "mentions": 0, "sentiment": 0.0})
    current["mentions"] += 1
    current["sentiment"] += event["sentiment"]
  return [
    {**value, "mentions": value["mentions"] * 12, "sentiment": round(value["sentiment"] / value["mentions"], 2)}
    for value in entities.values()
  ]
