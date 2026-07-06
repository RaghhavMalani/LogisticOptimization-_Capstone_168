# Data sources & API catalogue

Which API fills which gap in the system. Everything marked **live** is wired
into the code today; everything marked **planned** has a documented plug-in
point. All PortWatch layers are public ArcGIS feature services — **no API key**.

Base URL for all PortWatch layers:

```
https://services9.arcgis.com/weJ1QsnbMYJlCHdG/ArcGIS/rest/services/<layer>/FeatureServer/0/query
```

Query pattern: `?where=...&outFields=...&f=json&orderByFields=date&resultOffset=N`
(server caps pages at 1000 rows; page with `resultOffset` while
`exceededTransferLimit` is true — handled in `app/data/portwatch.py`).

## Live (wired in)

| Need | Source / layer | Used by | Status |
|---|---|---|---|
| Daily per-port vessel calls + import/export tonnes (the AIS signal) | IMF PortWatch `Daily_Ports_Data` (`where=country='India'`) | `--source portwatch`: observed targets + Port-Ops expert (PORTWATCH mode, `ais_confidence` 0.75) | **live**, cached under `data/portwatch/history/` |
| Chokepoint transits (Hormuz, Suez, Bab-el-Mandeb, Malacca…) | IMF PortWatch `Daily_Chokepoints_Data` | terminal watchlist + scenario engine | **live** |
| Climate/disaster alerts intersected with ports | IMF PortWatch `portwatch_disruptions_database` (GDACS) | storm flags into the Weather expert (portwatch source) | **live** |
| Port metadata (2,065 ports, lat/lon) | PortWatch ports database (India subset embedded in `app/data/portwatch.py`) | port registry / joins | **live** (static) |
| Oil price, USD/INR, inflation | FRED API (`DCOILBRENTEU`, `DEXINUS`, `INDCPIALLMINMEI`) | macro expert (HSMM conditions) | **live**, cached |
| Geopolitical/news events | GDELT API (national query) | macro expert `news_stress` | **live**, cached |

Refresh everything: `python -m app.data.portwatch` (open network needed) or
`python run_demo.py --refresh-portwatch --source portwatch`.

## Planned (documented plug-in points)

| Need | Recommended API | Plug-in point |
|---|---|---|
| Physical weather (wind, rain, visibility) + 10-day forecast | **Open-Meteo** — free, no key: `https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..&daily=wind_speed_10m_max,precipitation_sum&forecast_days=10`; history via `archive-api.open-meteo.com` | fill `wind_speed`/`rainfall` NaN columns in `portwatch_source.load_bundle()`; feeds `weather_expert.build_future_known()` (true future-known covariate for the TFT) |
| Wave height | **Open-Meteo Marine** `https://marine-api.open-meteo.com/v1/marine?...&daily=wave_height_max` | same as above (`wave_height`) |
| Cyclone alerts | IMD RSMC bulletins / GDACS API (`gdacs.org/xml/rss.xml`) | `storm_flag` (currently GDACS-via-PortWatch) |
| Port-level news / strikes | **GDELT DOC 2.0** `https://api.gdeltproject.org/api/v2/doc/doc?query=<port name> strike&mode=artlist&format=json` | `news_raw` in `portwatch_source` → News expert channels |
| Measured berth delay / dwell time (replace `delay_hours` proxy) | Indian port authority feeds: Sagar Setu / NLP-Marine, data.gov.in DGQI monthly dwell | swap into `_build_observed()`; DGQI adapter already exists (`--source real`) |
| Monthly commodity-level trade | data.gov.in / DGCIS API (key: free registration) | Trade/Demand expert (`trade_raw`) |
| Raw vessel positions (if budget allows) | AISHub (free exchange), Spire/MarineTraffic (paid), or **Google Earth Engine** Sentinel-1 ship detection | Port-Ops expert REAL mode (`ais_confidence` 0.9) |

## Provenance rules

Every source records LIVE / CACHED / SYNTHETIC in `outputs/analytics/provenance.json`;
expert confidence columns drop automatically when a source is missing or imputed.
