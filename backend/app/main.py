from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.routers import fleet, model, news, ports, sar, scenarios, weather

app = FastAPI(
  title="India PortWatch API",
  version="0.1.0",
  description="Backend-ready API for the India PortWatch AI Maritime Command Terminal.",
)

app.add_middleware(
  CORSMiddleware,
  allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
  return {
    "status": "ok",
    "service": "india-portwatch-api",
    "mode": "local-demo",
  }


app.include_router(ports.router)
app.include_router(weather.router)
app.include_router(sar.router)
app.include_router(news.router)
app.include_router(model.router)
app.include_router(scenarios.router)
app.include_router(fleet.router)
