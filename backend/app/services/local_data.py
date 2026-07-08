import csv
from pathlib import Path
from typing import Any


def read_csv(path: Path, limit: int | None = None) -> list[dict[str, str]]:
  if not path.exists():
    return []
  rows: list[dict[str, str]] = []
  with path.open("r", encoding="utf-8-sig", newline="") as handle:
    reader = csv.DictReader(handle)
    for row in reader:
      rows.append({key: value for key, value in row.items() if key is not None})
      if limit is not None and len(rows) >= limit:
        break
  return rows


def to_float(value: Any, default: float = 0.0) -> float:
  try:
    if value is None or value == "":
      return default
    return float(value)
  except (TypeError, ValueError):
    return default


def to_int(value: Any, default: int = 0) -> int:
  try:
    if value is None or value == "":
      return default
    return int(float(value))
  except (TypeError, ValueError):
    return default


def latest_by_date(rows: list[dict[str, str]], date_key: str = "date") -> dict[str, str] | None:
  if not rows:
    return None
  return max(rows, key=lambda row: row.get(date_key, ""))
