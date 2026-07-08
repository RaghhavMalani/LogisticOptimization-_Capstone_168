from backend.app.config import settings
from backend.app.services.local_data import read_csv

PORTWATCH_BASE_URL = "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/ArcGIS/rest/services"


def cached_port_activity(limit: int | None = None) -> list[dict[str, str]]:
  return read_csv(settings.data_dir / "portwatch" / "port_activity.csv", limit=limit)


def cached_chokepoints(limit: int | None = None) -> list[dict[str, str]]:
  return read_csv(settings.data_dir / "portwatch" / "chokepoints.csv", limit=limit)


def cached_disruptions(limit: int | None = None) -> list[dict[str, str]]:
  return read_csv(settings.data_dir / "portwatch" / "disruptions.csv", limit=limit)


def live_refresh_status() -> dict:
  return {
    "enabled": settings.enable_external_refresh,
    "baseUrl": PORTWATCH_BASE_URL,
    "status": "disabled_by_default",
  }
