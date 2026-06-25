"""Shared connector plumbing: HTTP-with-cache and offline fallback.

`cached_json` / `cached_text` try the network (if `requests` is available and
the cache is stale), persist the response under data/cache/, and on any failure
return the most recent cache or raise so the caller can fall back to a synthetic
snapshot. Nothing here ever crashes the pipeline.
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Optional

from src.utils.config import DATA_DIR
from src.utils.logging_utils import get_logger

log = get_logger(__name__)

CACHE_DIR: Path = DATA_DIR / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_TTL = 24 * 3600  # 1 day


def _requests():
    try:
        import requests
        return requests
    except Exception:
        return None


def _cache_path(key: str, ext: str) -> Path:
    safe = "".join(c if c.isalnum() or c in "-_." else "_" for c in key)
    return CACHE_DIR / f"{safe}.{ext}"


def _fresh(path: Path, ttl: int) -> bool:
    return path.exists() and (time.time() - path.stat().st_mtime) < ttl


def cached_text(url: str, key: str, ttl: int = DEFAULT_TTL,
                params: Optional[dict] = None, timeout: int = 20) -> Optional[str]:
    """Return text from cache (if fresh) or the network; cache on success."""
    path = _cache_path(key, "txt")
    if _fresh(path, ttl):
        return path.read_text(encoding="utf-8")

    requests = _requests()
    if requests is not None:
        try:
            r = requests.get(url, params=params, timeout=timeout)
            r.raise_for_status()
            path.write_text(r.text, encoding="utf-8")
            log.info("connector: fetched %s", key)
            return r.text
        except Exception as exc:
            log.warning("connector: live fetch failed for %s (%s).", key, exc)

    if path.exists():
        log.info("connector: using stale cache for %s", key)
        return path.read_text(encoding="utf-8")
    return None


def cached_json(url: str, key: str, ttl: int = DEFAULT_TTL,
                params: Optional[dict] = None, timeout: int = 20) -> Optional[dict]:
    txt = cached_text(url, key, ttl=ttl, params=params, timeout=timeout)
    if txt is None:
        return None
    try:
        return json.loads(txt)
    except Exception:
        return None


def save_snapshot(obj, key: str) -> None:
    """Persist a synthetic snapshot so future offline runs are deterministic."""
    _cache_path(key, "txt").write_text(json.dumps(obj, default=str), encoding="utf-8")
