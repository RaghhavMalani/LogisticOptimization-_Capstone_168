from fastapi import APIRouter

from backend.app.services.sar_connector import sar_provider_status
from backend.app.services.sar_service import get_sar_signal, list_vessels

router = APIRouter(prefix="/api/sar", tags=["sar"])


@router.get("/vessels")
def vessel_proxy() -> dict:
  return {
    "vessels": list_vessels(),
    "connector": sar_provider_status(),
  }


@router.get("/{port_id}")
def sar_for_port(port_id: str) -> dict:
  return {
    **get_sar_signal(port_id),
    "connector": sar_provider_status(),
  }
