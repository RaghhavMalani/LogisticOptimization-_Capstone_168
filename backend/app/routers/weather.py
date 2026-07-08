from fastapi import APIRouter

from backend.app.services.port_service import get_port
from backend.app.services.weather_connector import open_meteo_request_shape
from backend.app.services.weather_service import get_weather, list_weather

router = APIRouter(prefix="/api/weather", tags=["weather"])


@router.get("")
def list_weather_signals() -> list[dict]:
  return list_weather()


@router.get("/{port_id}")
def weather_for_port(port_id: str) -> dict:
  port = get_port(port_id)
  return {
    **get_weather(port_id),
    "connector": open_meteo_request_shape(port["lat"], port["lon"]),
  }
