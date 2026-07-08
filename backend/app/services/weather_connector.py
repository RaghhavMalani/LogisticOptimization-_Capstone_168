def open_meteo_request_shape(lat: float, lon: float) -> dict:
  return {
    "provider": "open-meteo",
    "forecastUrl": "https://api.open-meteo.com/v1/forecast",
    "marineUrl": "https://marine-api.open-meteo.com/v1/marine",
    "params": {
      "latitude": lat,
      "longitude": lon,
      "daily": "wind_speed_10m_max,precipitation_sum",
      "forecast_days": 10,
    },
    "status": "connector_ready_not_called",
  }
