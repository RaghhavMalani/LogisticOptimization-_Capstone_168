from backend.app.services.news_service import news_for_entity


def score_news(entity: str) -> dict:
  events = news_for_entity(entity)
  sentiment = sum(event["sentiment"] for event in events) / max(1, len(events))
  confidence = sum(event["confidence"] for event in events) / max(1, len(events))
  return {
    "module": "News/NLP Expert",
    "inputSignal": "GDELT/Reuter maritime tone",
    "score": round(abs(sentiment), 3),
    "confidence": round(confidence, 3),
    "effectOnForecast": round(abs(sentiment) * 0.18, 3),
    "timestamp": events[0]["timestamp"] if events else "08:45",
  }
