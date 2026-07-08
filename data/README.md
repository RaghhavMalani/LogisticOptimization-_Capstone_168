This folder contains the datasets used by the India PortWatch research pipeline,
backend fallbacks, and terminal demo.

## Layout

| Folder | Classification | Use |
|---|---|---|
| `portwatch/` | Live/cached public PortWatch data | Port activity, chokepoints, disruptions, map registry, historical port series |
| `preprocessed/` | Historical feature tables | Weather, news, macro/demand, DGQI dwell features |
| `sample/` | Synthetic smoke-test data | Local demo and pipeline smoke tests only |
| `cache/` | Connector cache | API response cache for PortWatch, FRED, GDELT, map/country data |

See `docs/DATA_AUDIT.md` and `docs/DATA_SOURCES.md` for source details,
coverage notes, and backend integration priority.
