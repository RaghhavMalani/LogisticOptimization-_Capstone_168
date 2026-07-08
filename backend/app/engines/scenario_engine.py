from backend.app.services.port_service import list_ports

SCENARIOS = [
  {"key": "STORM_W", "commandAlias": "STORM_W", "name": "West Coast Storm Surge", "affectedCoasts": ["west"], "baseCongestionDelta": 0.18, "baseDelayDeltaHours": 5.2, "baseThroughputDelta": -0.13},
  {"key": "CYC_E", "commandAlias": "CYCLONE_EAST", "name": "East Coast Cyclone", "affectedCoasts": ["east"], "baseCongestionDelta": 0.24, "baseDelayDeltaHours": 7.8, "baseThroughputDelta": -0.18},
  {"key": "LABOUR", "commandAlias": "LABOUR", "name": "Labour Rotation Shock", "affectedCoasts": ["west", "east"], "baseCongestionDelta": 0.12, "baseDelayDeltaHours": 3.8, "baseThroughputDelta": -0.1},
  {"key": "HORMUZ", "commandAlias": "HORMUZ", "name": "Hormuz Transit Shock", "affectedCoasts": ["west"], "baseCongestionDelta": 0.16, "baseDelayDeltaHours": 6.5, "baseThroughputDelta": -0.07},
  {"key": "REDSEA", "commandAlias": "REDSEA", "name": "Red Sea Reroute", "affectedCoasts": ["west"], "baseCongestionDelta": 0.14, "baseDelayDeltaHours": 8.0, "baseThroughputDelta": -0.08},
]


def scenario_definitions() -> list[dict]:
  return SCENARIOS


def clamp(value: float, minimum: float, maximum: float) -> float:
  return min(maximum, max(minimum, value))


def risk_from_score(score: float) -> str:
  if score >= 86:
    return "severe"
  if score >= 68:
    return "high"
  if score >= 42:
    return "medium"
  return "normal"


def _resolve_scenario(key: str) -> dict:
  normalized = key.strip().upper()
  for scenario in SCENARIOS:
    if normalized in {scenario["key"], scenario["commandAlias"]}:
      return scenario
  return SCENARIOS[1]


def simulate_scenario(key: str, intensity: float = 1.5, run_id: int = 1247) -> dict:
  scenario = _resolve_scenario(key)
  safe_intensity = clamp(float(intensity), 0.5, 2.0)
  impacted = []

  for port in list_ports():
    coast_multiplier = 1.0 if port["coast"] in scenario["affectedCoasts"] else 0.42
    chokepoint_multiplier = 1.0
    if scenario["key"] == "HORMUZ" and port["code"] in {"INMUN", "INIXY", "INBOM", "INNSA", "INCOK"}:
      chokepoint_multiplier = 1.28
    if scenario["key"] == "REDSEA" and port["coast"] == "west":
      chokepoint_multiplier = 1.15

    congestion_delta = clamp(scenario["baseCongestionDelta"] * safe_intensity * coast_multiplier * chokepoint_multiplier, 0, 0.7)
    delay_delta = scenario["baseDelayDeltaHours"] * safe_intensity * coast_multiplier * chokepoint_multiplier
    throughput_delta = scenario["baseThroughputDelta"] * safe_intensity * coast_multiplier
    impact_score = clamp((port["congestion"] + congestion_delta) * 100 + delay_delta * 1.4, 0, 99)
    impacted.append({
      "portCode": port["code"],
      "portName": port["name"],
      "impactScore": round(impact_score),
      "riskLevel": risk_from_score(impact_score),
      "congestionDelta": round(congestion_delta, 3),
      "delayDeltaHours": round(delay_delta, 2),
      "throughputDelta": round(throughput_delta, 3),
    })

  affected_ports = sorted(impacted, key=lambda item: item["impactScore"], reverse=True)[:8]
  congestion_delta_pct = sum(item["congestionDelta"] for item in affected_ports) / max(1, len(affected_ports)) * 100
  delay_delta_hours = sum(item["delayDeltaHours"] for item in affected_ports) / max(1, len(affected_ports))
  throughput_delta_pct = sum(item["throughputDelta"] for item in affected_ports) / max(1, len(affected_ports)) * 100
  freight_delta = clamp(delay_delta_hours * 0.78, 1.5, 18)
  risk_level = risk_from_score(max(item["impactScore"] for item in affected_ports))
  recommendation = {
    "id": f"REC-{scenario['key']}-{safe_intensity:.1f}",
    "scenarioKey": scenario["key"],
    "severity": risk_level,
    "title": "Escalate to national berth coordination" if risk_level == "severe" else "Activate targeted congestion controls",
    "actions": [
      "Stagger inbound ETAs by 24-48h for high-risk vessels",
      "Reserve yard capacity for priority cargo",
      "Push updated delay guidance to fleet operators",
    ],
    "rationale": f"Scenario engine projects +{congestion_delta_pct:.1f}% congestion and +{delay_delta_hours:.1f}h delay.",
    "confidence": round(clamp(0.78 + safe_intensity * 0.05, 0, 0.94), 2),
    "timestamp": "08:45:00Z",
  }
  return {
    "scenarioKey": scenario["key"],
    "scenarioName": scenario["name"],
    "intensity": safe_intensity,
    "runId": run_id,
    "affectedPorts": affected_ports,
    "congestionDelta": round(congestion_delta_pct, 2),
    "delayDeltaHours": round(delay_delta_hours, 2),
    "throughputDelta": round(throughput_delta_pct, 2),
    "freightDelta": round(freight_delta, 2),
    "riskLevel": risk_level,
    "recommendation": recommendation,
    "routeImpacts": [
      {"name": "West Coast Route", "delayDeltaHours": round(delay_delta_hours * (1.1 if "west" in scenario["affectedCoasts"] else 0.65), 2), "riskLevel": risk_level if "west" in scenario["affectedCoasts"] else "medium"},
      {"name": "East Coast Route", "delayDeltaHours": round(delay_delta_hours * (1.05 if "east" in scenario["affectedCoasts"] else 0.55), 2), "riskLevel": risk_level if "east" in scenario["affectedCoasts"] else "medium"},
      {"name": "India -> Europe", "delayDeltaHours": round(delay_delta_hours * (1.35 if scenario["key"] == "REDSEA" else 0.9), 2), "riskLevel": "severe" if scenario["key"] == "REDSEA" else risk_level},
      {"name": "India -> US East Coast", "delayDeltaHours": round(delay_delta_hours * 0.8, 2), "riskLevel": risk_level},
      {"name": "India -> GCC", "delayDeltaHours": round(delay_delta_hours * (1.4 if scenario["key"] == "HORMUZ" else 0.65), 2), "riskLevel": "severe" if scenario["key"] == "HORMUZ" else "medium"},
    ],
    "chokepointImpacts": [
      {"name": "Strait of Hormuz", "riskLevel": "severe" if scenario["key"] == "HORMUZ" else "high" if "west" in scenario["affectedCoasts"] else "medium"},
      {"name": "Bab-el-Mandeb", "riskLevel": "severe" if scenario["key"] == "REDSEA" else "medium"},
      {"name": "Malacca Strait", "riskLevel": "high" if "east" in scenario["affectedCoasts"] else "normal"},
      {"name": "Suez Canal", "riskLevel": "high" if scenario["key"] == "REDSEA" else "normal"},
      {"name": "Cape of Good Hope", "riskLevel": "medium" if scenario["key"] == "REDSEA" else "normal"},
    ],
    "source": "DETERMINISTIC_DEMO_ENGINE",
  }
