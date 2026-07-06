"""India PortWatch — central config (lean, Phase-2 aligned).

Project 168: Real-Time Predictive Risk Analysis for Indian Ports.
Pipeline: data -> expert feature modules -> HSMM (regime) -> TFT (1-10 day
forecast) -> decision layer -> dashboard.

This rebuild is deliberately minimal and uses ONLY the team's real datasets:
  data/preprocessed/weather_preprocessed_2020_2022.csv
  data/preprocessed/maritime_news_preprocessed.csv
  data/preprocessed/final_economic_features.csv
  data/preprocessed/DGQI_merged_2020_2022.csv      (port dwell time)
Optional real files (slots that auto-activate when present):
  data/satellite_ports.csv     (SAR ship-counts per port)
  data/disaster_preprocessed.csv
"""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
PRE = DATA / "preprocessed"
OUT = ROOT / "outputs"

# real data files
WEATHER_CSV = PRE / "weather_preprocessed_2020_2022.csv"
NEWS_CSV = PRE / "maritime_news_preprocessed.csv"
ECON_CSV = PRE / "final_economic_features.csv"
DWELL_CSV = PRE / "DGQI_merged_2020_2022.csv"
# optional real slots
SATELLITE_CSV = DATA / "satellite_ports.csv"
DISASTER_CSV = DATA / "disaster_preprocessed.csv"

FORECAST_HORIZON = 10            # 1-10 day forecasts (per objectives)
QUANTILES = [0.1, 0.5, 0.9]
REGIMES = ["NORMAL", "CONGESTED", "DISRUPTED"]   # deck: Normal/Congested/Highly-disrupted
SEED = 42


def ensure_dirs() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "features").mkdir(exist_ok=True)
    (OUT / "regimes").mkdir(exist_ok=True)
    (OUT / "forecasts").mkdir(exist_ok=True)
    (OUT / "decisions").mkdir(exist_ok=True)


# Canonical Indian ports (from the DGQI dwell dataset) + approx coords for maps.
# port_id -> (display name, lat, lon, region). Derived from the team's DGQI file;
# coords are standard public locations.
PORTS = {
    "JNPT": ("Jawaharlal Nehru (Nhava Sheva)", 18.95, 72.95, "West"),
    "APSEZ": ("Mundra (APSEZ)", 22.74, 69.70, "West"),
    "KANDLA": ("Deendayal (Kandla)", 23.02, 70.22, "West"),
    "HAZIRA": ("Hazira", 21.10, 72.62, "West"),
    "COCHIN": ("Cochin", 9.97, 76.27, "South"),
    "NMPT": ("New Mangalore", 12.92, 74.80, "West"),
    "CHENNAI": ("Chennai", 13.10, 80.30, "East"),
    "KATTUPALLI": ("Kattupalli", 13.28, 80.33, "East"),
    "TUTICORIN": ("V.O. Chidambaranar (Tuticorin)", 8.75, 78.20, "South"),
    "KRISHNAPATNAM": ("Krishnapatnam", 14.27, 80.12, "East"),
    "KOLKATA": ("Kolkata", 22.55, 88.31, "East"),
    "HALDIA": ("Haldia", 22.07, 88.10, "East"),
}

# Map DGQI portName strings -> canonical ids.
DWELL_ALIASES = {
    "JNPT": "JNPT", "APSEZ": "APSEZ", "KANDLA": "KANDLA", "HAZIRA": "HAZIRA",
    "COCHIN": "COCHIN", "NMPT": "NMPT", "CHENNAI": "CHENNAI",
    "KATTUPALLI": "KATTUPALLI", "TUTICORIN": "TUTICORIN",
    "KRISHNAPATNAM": "KRISHNAPATNAM", "KOLKATA": "KOLKATA", "HALDIA": "HALDIA",
}
