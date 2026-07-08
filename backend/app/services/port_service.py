from backend.app.config import settings
from backend.app.services.local_data import read_csv, to_float, to_int


PORTS = [
  {"code": "INMUN", "model_id": "MUNDRA", "name": "Mundra", "short": "MUN", "authority": "Adani Ports and SEZ", "lat": 22.74, "lon": 69.7, "coast": "west"},
  {"code": "INIXY", "model_id": "DEENDAYAL", "name": "Deendayal / Kandla", "short": "KDL", "authority": "Deendayal Port Authority", "lat": 23.02, "lon": 70.22, "coast": "west"},
  {"code": "INBOM", "model_id": "MUMBAI", "name": "Mumbai", "short": "BOM", "authority": "Mumbai Port Authority", "lat": 18.95, "lon": 72.83, "coast": "west"},
  {"code": "INNSA", "model_id": "JNPT", "name": "JNPT / Nhava Sheva", "short": "JNP", "authority": "Jawaharlal Nehru Port Authority", "lat": 18.95, "lon": 72.95, "coast": "west"},
  {"code": "INMRM", "model_id": "MORMUGAO", "name": "Mormugao", "short": "MRM", "authority": "Mormugao Port Authority", "lat": 15.41, "lon": 73.8, "coast": "west"},
  {"code": "ININM", "model_id": "MANGALORE", "name": "New Mangalore", "short": "NML", "authority": "New Mangalore Port Authority", "lat": 12.92, "lon": 74.8, "coast": "west"},
  {"code": "INCOK", "model_id": "COCHIN", "name": "Cochin", "short": "COK", "authority": "Cochin Port Authority", "lat": 9.96, "lon": 76.24, "coast": "west"},
  {"code": "INTUT", "model_id": "TUTICORIN", "name": "Tuticorin (V.O.C.)", "short": "TUT", "authority": "V.O. Chidambaranar Port Authority", "lat": 8.79, "lon": 78.13, "coast": "east"},
  {"code": "INMAA", "model_id": "CHENNAI", "name": "Chennai", "short": "MAA", "authority": "Chennai Port Authority", "lat": 13.08, "lon": 80.29, "coast": "east"},
  {"code": "INENR", "model_id": "ENNORE", "name": "Kamarajar / Ennore", "short": "ENR", "authority": "Kamarajar Port Limited", "lat": 13.25, "lon": 80.33, "coast": "east"},
  {"code": "INVTZ", "model_id": "VISAKHAPATNAM", "name": "Visakhapatnam", "short": "VTZ", "authority": "Visakhapatnam Port Authority", "lat": 17.68, "lon": 83.21, "coast": "east"},
  {"code": "INPRT", "model_id": "PARADIP", "name": "Paradip", "short": "PRT", "authority": "Paradip Port Authority", "lat": 20.26, "lon": 86.67, "coast": "east"},
  {"code": "INHAL", "model_id": "KOLKATA", "name": "Haldia / Kolkata", "short": "HAL", "authority": "Syama Prasad Mookerjee Port", "lat": 22.03, "lon": 88.06, "coast": "east"},
]

PORT_RISKS = {
  "INMUN": ("congested", 0.62, 14, 178, 82, 0.88, "CONGESTED_MED"),
  "INIXY": ("congested", 0.58, 12, 141, 61, 0.84, "CONGESTED_MED"),
  "INBOM": ("severe", 0.83, 22, 96, 54, 0.91, "CONGESTED_HIGH"),
  "INNSA": ("severe", 0.79, 19, 208, 71, 0.93, "CONGESTED_HIGH"),
  "INMRM": ("normal", 0.34, 6, 44, 22, 0.82, "NORMAL"),
  "ININM": ("normal", 0.28, 5, 41, 19, 0.79, "NORMAL"),
  "INCOK": ("congested", 0.55, 11, 63, 34, 0.85, "CONGESTED_MED"),
  "INTUT": ("normal", 0.31, 6, 38, 18, 0.8, "NORMAL"),
  "INMAA": ("severe", 0.86, 24, 152, 68, 0.94, "CONGESTED_HIGH"),
  "INENR": ("congested", 0.61, 13, 88, 41, 0.87, "CONGESTED_MED"),
  "INVTZ": ("congested", 0.57, 12, 121, 49, 0.86, "CONGESTED_MED"),
  "INPRT": ("lowconf", 0.48, 9, 104, 37, 0.52, "WATCH_LOW_CONF"),
  "INHAL": ("congested", 0.60, 13, 87, 40, 0.83, "CONGESTED_MED"),
}

CHOKEPOINTS = [
  {"code": "HRMZ", "name": "HORMUZ STRAIT", "lat": 26.57, "lon": 56.25, "status": "elevated"},
  {"code": "BAB", "name": "BAB-EL-MANDEB", "lat": 12.58, "lon": 43.33, "status": "watch"},
  {"code": "SUEZ", "name": "SUEZ CANAL", "lat": 30.0, "lon": 32.55, "status": "normal"},
  {"code": "MLC", "name": "MALACCA STRAIT", "lat": 2.5, "lon": 101.5, "status": "severe"},
]

CHOKEPOINT_ROUTES = [
  {"fromPortCode": "INNSA", "toChokepointCode": "HRMZ", "label": "IN -> Hormuz", "risk": "elevated"},
  {"fromPortCode": "INMUN", "toChokepointCode": "SUEZ", "label": "IN -> Suez", "risk": "watch"},
  {"fromPortCode": "INCOK", "toChokepointCode": "BAB", "label": "IN -> Bab-el-Mandeb", "risk": "watch"},
  {"fromPortCode": "INMAA", "toChokepointCode": "MLC", "label": "IN -> Malacca", "risk": "severe"},
  {"fromPortCode": "INVTZ", "toChokepointCode": "MLC", "label": "VTZ -> Malacca", "risk": "severe"},
]


def model_id_for(port_id: str) -> str:
  return get_port(port_id)["model_id"]


def get_port(port_id: str) -> dict:
  normalized = port_id.strip().upper()
  for port in PORTS:
    if normalized in {port["code"], port["short"], port["model_id"]} or normalized in port["name"].upper():
      return port
  return PORTS[0]


def _risk_payload(code: str) -> dict:
  risk, congestion, delay, throughput, vessels, confidence, regime = PORT_RISKS.get(code, PORT_RISKS["INMAA"])
  return {
    "risk": risk,
    "congestion": congestion,
    "delayHours": delay,
    "throughput": throughput,
    "vessels": vessels,
    "confidence": confidence,
    "regime": regime,
    "updatedAt": "08:45:00Z",
  }


def _activity_summary_by_model_id() -> dict[str, dict[str, str]]:
  rows = read_csv(settings.data_dir / "portwatch" / "port_activity_summary.csv")
  return {row.get("canon", "").upper(): row for row in rows}


def port_snapshot(port: dict) -> dict:
  summary = _activity_summary_by_model_id().get(port["model_id"], {})
  return {
    **port,
    "location": {"lat": port["lat"], "lon": port["lon"]},
    "source": "LOCAL_DEMO_WITH_PORTWATCH_FALLBACK",
    "portcalls": to_int(summary.get("portcalls"), 0),
    "importTonnes": to_float(summary.get("import_tonnes"), 0.0),
    "exportTonnes": to_float(summary.get("export_tonnes"), 0.0),
    **_risk_payload(port["code"]),
  }


def list_ports() -> list[dict]:
  return [port_snapshot(port) for port in PORTS]


def list_map_pins() -> dict:
  return {
    "ports": list_ports(),
    "chokepoints": CHOKEPOINTS,
    "routes": CHOKEPOINT_ROUTES,
    "source": "LOCAL_DEMO",
  }


def get_port_snapshot(port_id: str) -> dict:
  return port_snapshot(get_port(port_id))


def national_stress() -> dict:
  ports = list_ports()
  mean_congestion = sum(port["congestion"] for port in ports) / max(1, len(ports))
  severe_share = sum(1 for port in ports if port["risk"] == "severe") / max(1, len(ports))
  return {
    "score": round(mean_congestion * 70 + severe_share * 30),
    "severePorts": [port["code"] for port in ports if port["risk"] == "severe"],
    "meanCongestion": round(mean_congestion, 3),
    "source": "LOCAL_DEMO",
  }
