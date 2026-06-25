"""External data connectors.

Each connector fetches a live source (IMF PortWatch, FRED/EIA markets, GDELT
events) but is wrapped so it ALWAYS returns usable data:

    live API  ->  on-disk cache (TTL)  ->  bundled synthetic snapshot

So the system runs fully offline (no internet, no API keys) for a demo, yet
upgrades to real data the moment connectivity/keys are present.
"""

from src.ingestion.connectors import portwatch, markets, events  # noqa: F401
