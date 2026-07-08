# India PortWatch API Contract

Base URL during local development: `http://127.0.0.1:8000`

All endpoints are JSON and are currently backend-ready local/demo implementations.

## Health

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Service status |

## Ports And Map

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/ports` | List normalized port operational snapshots |
| `GET` | `/api/ports/map` | Port pins, chokepoints, and route metadata |
| `GET` | `/api/ports/stress` | National logistics stress score |
| `GET` | `/api/ports/source-status` | Local/live source readiness |
| `GET` | `/api/ports/{port_id}` | Port cockpit snapshot |
| `GET` | `/api/ports/{port_id}/live` | Port snapshot with signal provenance |

## Signals

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/weather` | Weather signals for active ports |
| `GET` | `/api/weather/{port_id}` | Weather expert input for a port |
| `GET` | `/api/sar/vessels` | SAR/AIS proxy vessel positions |
| `GET` | `/api/sar/{port_id}` | SAR scene and anchorage signal |
| `GET` | `/api/news` | News events, alerts, sentiment summary |
| `GET` | `/api/news/alerts` | Active alert feed |
| `GET` | `/api/news/entity/{entity}` | Focused news/NLP entity feed |

## Model And Decisions

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/model/pipeline` | Weather Expert -> News/NLP Expert -> SAR/AIS Proxy Expert -> Demand Expert -> HSMM Regime -> TFT Forecast -> Decision Layer |
| `GET` | `/api/model/{port_id}/regime` | HSMM regime state and probabilities |
| `GET` | `/api/model/{port_id}/forecast` | 10-day forecast points |
| `GET` | `/api/model/{port_id}/decision` | Decision recommendation |

## Scenarios And Fleet

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/scenarios` | Supported scenario definitions |
| `POST` | `/api/scenarios/simulate` | Deterministic scenario impact result |
| `GET` | `/api/fleet` | Fleet vessel risk list |

Scenario simulation request:

```json
{
  "scenarioKey": "CYC_E",
  "intensity": 1.5,
  "runId": 1247
}
```

Scenario simulation response includes:

- `affectedPorts`
- `congestionDelta`
- `delayDeltaHours`
- `throughputDelta`
- `riskLevel`
- `recommendation`

## Provenance Labels

The current API uses these source labels:

- `LOCAL_DEMO`
- `LOCAL_DEMO_WITH_PORTWATCH_FALLBACK`
- `OUTPUTS_REGIMES`
- `DECISION_ENGINE_DEMO`
- `DETERMINISTIC_DEMO_ENGINE`
- `connector_ready_not_called`

Live connectors should preserve the same response shapes and update only the `source`/`connector` fields and payload values.
