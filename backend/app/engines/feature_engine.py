from backend.app.services.news_service import news_for_entity
from backend.app.services.port_service import get_port_snapshot
from backend.app.services.sar_service import get_sar_signal
from backend.app.services.weather_service import get_weather


def build_feature_vector(port_id: str) -> dict:
  port = get_port_snapshot(port_id)
  weather = get_weather(port["code"])
  sar = get_sar_signal(port["code"])
  news = news_for_entity(port["name"].split()[0])
  news_pressure = abs(sum(event["sentiment"] for event in news) / max(1, len(news)))
  return {
    "portCode": port["code"],
    "congestion": port["congestion"],
    "delayHours": port["delayHours"],
    "weatherImpact": weather["impactScore"],
    "sarQueuePressure": min(1.0, sar["anchorageCount"] / 35),
    "newsPressure": round(news_pressure, 3),
    "demandPressure": round(min(1.0, port["throughput"] / 220), 3),
    "confidence": round((port["confidence"] + weather["persistenceScore"] + sar["confidence"]) / 3, 3),
    "source": "LOCAL_FEATURE_ENGINE",
  }
