from backend.app.config import settings
from backend.app.services.local_data import read_csv, to_float, to_int
from backend.app.services.port_service import get_port, model_id_for

PIPELINE = [
  {"key": "WX", "name": "Weather Expert", "inputSignal": "wind/wave/rain/cyclone", "score": 0.71, "confidence": 0.86, "effectOnForecast": "+18% delay pressure", "timestamp": "08:41:03Z"},
  {"key": "NLP", "name": "News/NLP Expert", "inputSignal": "GDELT/Reuter maritime tone", "score": 0.63, "confidence": 0.83, "effectOnForecast": "+9% geopolitical pressure", "timestamp": "08:40:12Z"},
  {"key": "SAR", "name": "SAR/AIS Proxy Expert", "inputSignal": "SAR detections + AIS queue", "score": 0.58, "confidence": 0.79, "effectOnForecast": "+11% anchorage pressure", "timestamp": "08:39:44Z"},
  {"key": "DEM", "name": "Demand Expert", "inputSignal": "throughput/import/export trend", "score": 0.44, "confidence": 0.81, "effectOnForecast": "+4% demand pressure", "timestamp": "08:39:08Z"},
  {"key": "HSMM", "name": "HSMM Regime", "inputSignal": "expert feature panel", "score": 0.77, "confidence": 0.88, "effectOnForecast": "state persistence high", "timestamp": "08:38:50Z"},
  {"key": "TFT", "name": "TFT Forecast", "inputSignal": "known future + encoder history", "score": 0.69, "confidence": 0.86, "effectOnForecast": "10-day quantiles", "timestamp": "08:38:22Z"},
  {"key": "DEC", "name": "Decision Layer", "inputSignal": "risk-adjusted forecast", "score": 0.74, "confidence": 0.9, "effectOnForecast": "operational actions", "timestamp": "08:38:05Z"},
]


def pipeline_status() -> list[dict]:
  return PIPELINE


def latest_regime(port_id: str) -> dict:
  port = get_port(port_id)
  model_id = model_id_for(port["code"])
  rows = [row for row in read_csv(settings.outputs_dir / "regimes" / "regimes.csv") if row.get("port_id", "").upper() == model_id]
  if rows:
    row = max(rows, key=lambda item: item.get("date", ""))
    return {
      "portCode": port["code"],
      "state": row.get("regime_label", "NORMAL"),
      "probabilities": {
        "normal": to_float(row.get("p_normal")),
        "congested": to_float(row.get("p_congested")),
        "severe": to_float(row.get("p_severe")),
      },
      "daysInState": to_float(row.get("days_in_state")),
      "expectedRemainingDays": to_float(row.get("expected_remaining_days")),
      "transitionRisk24h": to_float(row.get("transition_risk")),
      "confidence": to_float(row.get("regime_confidence"), 0.8),
      "timestamp": row.get("date", "08:45:00Z"),
      "source": "OUTPUTS_REGIMES",
    }
  return {
    "portCode": port["code"],
    "state": "CONGESTED_HIGH" if port["code"] in {"INMAA", "INBOM", "INNSA"} else "NORMAL",
    "probabilities": {"normal": 0.12, "congested": 0.58, "severe": 0.3},
    "daysInState": 3,
    "expectedRemainingDays": 2.4,
    "transitionRisk24h": 0.61,
    "confidence": 0.84,
    "timestamp": "08:45:00Z",
    "source": "LOCAL_DEMO",
  }


def forecast(port_id: str) -> list[dict]:
  port = get_port(port_id)
  model_id = model_id_for(port["code"])
  rows = [row for row in read_csv(settings.outputs_dir / "forecasts" / "forecast_table.csv") if row.get("port_id", "").upper() == model_id]
  if rows:
    return [
      {
        "portCode": port["code"],
        "day": to_int(row.get("horizon_day")),
        "dateLabel": row.get("target_date", ""),
        "congestionIndex": round(to_float(row.get("predicted_congestion")), 2),
        "delayHoursP95": round(to_float(row.get("predicted_delay")), 2),
        "uncertaintyBandHours": round(abs(to_float(row.get("q90")) - to_float(row.get("q10"))) / 10, 2),
        "weatherProbability": 0.34 if port["coast"] == "east" else 0.12,
        "severity": row.get("risk_level", "Medium").upper(),
        "confidence": to_float(row.get("confidence_score"), 0.7),
        "source": row.get("model", "baseline"),
      }
      for row in sorted(rows, key=lambda item: to_int(item.get("horizon_day")))[:10]
    ]
  base = 62 if port["code"] in {"INMAA", "INBOM", "INNSA"} else 46
  return [
    {
      "portCode": port["code"],
      "day": day,
      "dateLabel": f"T+{day}",
      "congestionIndex": base + day * 1.6,
      "delayHoursP95": 7 + day * 0.8,
      "uncertaintyBandHours": 2 + day * 0.2,
      "weatherProbability": 0.34 if port["coast"] == "east" else 0.12,
      "severity": "HIGH" if day > 3 else "MOD",
      "confidence": 0.78,
      "source": "LOCAL_DEMO",
    }
    for day in range(1, 11)
  ]


def decision(port_id: str) -> dict:
  port = get_port(port_id)
  regime = latest_regime(port["code"])
  severity = "severe" if regime["probabilities"]["severe"] > 0.45 else "high"
  return {
    "id": f"DEC-{port['code']}",
    "portCode": port["code"],
    "severity": severity,
    "title": "Activate congestion protocol",
    "actions": [
      "Prioritize berth allocation",
      "Stagger inbound ETA windows",
      "Advise high-risk vessels to slow steam",
      "Review alternate port capacity",
    ],
    "rationale": "Weather, SAR/AIS queue growth, news pressure, and regime persistence are jointly elevating delay risk.",
    "confidence": regime["confidence"],
    "timestamp": "08:45:00Z",
    "source": "DECISION_ENGINE_DEMO",
  }
