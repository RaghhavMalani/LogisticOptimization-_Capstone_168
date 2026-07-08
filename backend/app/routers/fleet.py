from fastapi import APIRouter

from backend.app.services.fleet_service import list_fleet

router = APIRouter(prefix="/api/fleet", tags=["fleet"])


@router.get("")
def fleet() -> list[dict]:
  return list_fleet()
