def gdelt_request_shape(query: str) -> dict:
  return {
    "provider": "gdelt-doc-2",
    "url": "https://api.gdeltproject.org/api/v2/doc/doc",
    "params": {
      "query": query,
      "mode": "artlist",
      "format": "json",
    },
    "status": "connector_ready_not_called",
  }
