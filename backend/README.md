# India PortWatch FastAPI Backend

This is the backend-ready API shell for the Lovable terminal frontend.

The service is intentionally deterministic today:

- It reads local demo/domain data first.
- It can read generated model outputs from `outputs/`.
- Connector modules are shaped for PortWatch, Open-Meteo, GDELT, SAR/AIS, and future port authority feeds.
- External network refresh is disabled by default.

Run locally from the repository root:

```powershell
py -3 -m venv .venv-portwatch
.venv-portwatch\Scripts\python -m pip install -r backend\requirements.txt
.venv-portwatch\Scripts\python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

Primary endpoints:

- `GET /api/health`
- `GET /api/ports`
- `GET /api/ports/map`
- `GET /api/ports/{port_id}`
- `GET /api/weather/{port_id}`
- `GET /api/sar/{port_id}`
- `GET /api/sar/vessels`
- `GET /api/news`
- `GET /api/news/entity/{entity}`
- `GET /api/model/pipeline`
- `GET /api/model/{port_id}/regime`
- `GET /api/model/{port_id}/forecast`
- `GET /api/model/{port_id}/decision`
- `GET /api/scenarios`
- `POST /api/scenarios/simulate`
- `GET /api/fleet`

The older Rust backend in `india-portwatch/backend/` remains a valid reference and was not deleted.
