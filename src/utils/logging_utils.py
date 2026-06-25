"""Tiny logging helper so every module logs in a consistent format.

Usage:
    from src.utils.logging_utils import get_logger
    log = get_logger(__name__)
    log.info("hello")
"""

from __future__ import annotations

import logging
import sys

_CONFIGURED = False
_FORMAT = "%(asctime)s | %(levelname)-7s | %(name)s | %(message)s"
_DATEFMT = "%H:%M:%S"


def _configure_root(level: int = logging.INFO) -> None:
    global _CONFIGURED
    if _CONFIGURED:
        return
    handler = logging.StreamHandler(stream=sys.stdout)
    handler.setFormatter(logging.Formatter(_FORMAT, datefmt=_DATEFMT))
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)
    _CONFIGURED = True


def get_logger(name: str, level: int = logging.INFO) -> logging.Logger:
    """Return a configured logger. Safe to call many times."""
    _configure_root(level)
    logger = logging.getLogger(name)
    logger.setLevel(level)
    return logger


def section(logger: logging.Logger, title: str) -> None:
    """Log a visually distinct section header (handy in the demo runner)."""
    bar = "=" * 70
    logger.info(bar)
    logger.info(title)
    logger.info(bar)
