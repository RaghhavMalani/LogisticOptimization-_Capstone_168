from fastapi import APIRouter

from backend.app.services import port_service
from backend.app.services.portwatch_connector import cached_chokepoints, cached_disruptions, cached_port_activity, live_refresh_status

router = APIRouter(prefix="/api/ports", tags=["ports"])


@router.get("")
def list_ports() -> list[dict]:
  return port_service.list_ports()


@router.get("/map")
def map_payload() -> dict:
  return port_service.list_map_pins()


@router.get("/stress")
def national_stress() -> dict:
  return port_service.national_stress()


@router.get("/source-status")
def source_status() -> dict:
  return {
    "portwatch": live_refresh_status(),
    "cachedRows": {
      "activity": len(cached_port_activity(limit=100000)),
      "chokepoints": len(cached_chokepoints(limit=100000)),
      "disruptions": len(cached_disruptions(limit=100000)),
    },
  }


@router.get("/{port_id}")
def get_port(port_id: str) -> dict:
  return port_service.get_port_snapshot(port_id)


@router.get("/{port_id}/live")
def get_port_live(port_id: str) -> dict:
  return {
    **port_service.get_port_snapshot(port_id),
    "liveSignals": {
      "portwatch": "cached",
      "weather": "demo",
      "sar": "proxy",
      "news": "demo",
    },
  }
