def sar_provider_status() -> dict:
  return {
    "providers": ["Sentinel-1 via Google Earth Engine", "AIS provider feed"],
    "mode": "proxy_demo",
    "status": "connector_ready_not_called",
  }
