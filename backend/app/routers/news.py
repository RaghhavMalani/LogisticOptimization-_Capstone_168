from fastapi import APIRouter

from backend.app.services.news_connector import gdelt_request_shape
from backend.app.services.news_service import list_alerts, list_news, news_for_entity, sentiment_summary

router = APIRouter(prefix="/api/news", tags=["news"])


@router.get("")
def news_feed() -> dict:
  return {
    "events": list_news(),
    "alerts": list_alerts(),
    "sentiment": sentiment_summary(),
    "connector": gdelt_request_shape("India maritime port OR shipping"),
  }


@router.get("/alerts")
def alerts() -> list[dict]:
  return list_alerts()


@router.get("/entity/{entity}")
def entity_feed(entity: str) -> dict:
  return {
    "entity": entity.upper(),
    "events": news_for_entity(entity),
    "connector": gdelt_request_shape(entity),
  }
