"""Data provenance / readiness registry.

Every connector records whether the data it returned came from a LIVE API, a
cached copy, or a SYNTHETIC fallback. This makes the system honest about what is
real vs simulated -- the same transparency IMF PortWatch provides on its
'Data & Methodology' page -- and surfaces a readiness panel in the dashboard.

    from src.utils.provenance import record
    record("Brent crude (FRED)", "live")
    record("AIS / port ops", "synthetic", "no satellite feed wired yet")
"""

from __future__ import annotations

import json
import time
from typing import Dict

from src.utils.config import ANALYTICS_DIR

LIVE, CACHE, SYNTHETIC = "live", "cache", "synthetic"
_STATE: Dict[str, dict] = {}


def record(source: str, status: str, detail: str = "") -> None:
    _STATE[source] = {"status": status, "detail": detail,
                      "ts": time.strftime("%Y-%m-%d %H:%M")}


def get_all() -> Dict[str, dict]:
    return dict(_STATE)


def readiness_score() -> float:
    """Fraction of sources that are live or cached (0..1)."""
    if not _STATE:
        return 0.0
    real = sum(1 for v in _STATE.values() if v["status"] in (LIVE, CACHE))
    return round(real / len(_STATE), 2)


def save() -> None:
    ANALYTICS_DIR.mkdir(parents=True, exist_ok=True)
    payload = {"sources": _STATE, "readiness": readiness_score()}
    (ANALYTICS_DIR / "provenance.json").write_text(json.dumps(payload, indent=2))
