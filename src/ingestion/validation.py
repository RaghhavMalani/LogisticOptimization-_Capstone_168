"""Lightweight, dependency-free data validation.

These checks are meant to catch the kinds of problems that quietly break a
time-series pipeline (missing key columns, unparseable dates, duplicate
port/date rows, all-NaN columns). They never raise on warnings -- they return a
structured report so the demo can print it and keep going.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List

import pandas as pd

from src.utils.config import DATE, PORT_ID
from src.utils.logging_utils import get_logger

log = get_logger(__name__)


@dataclass
class ValidationReport:
    name: str
    n_rows: int
    issues: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.issues

    def summary(self) -> str:
        status = "OK" if self.ok else "FAIL"
        msg = f"[{status}] {self.name}: {self.n_rows} rows"
        if self.issues:
            msg += " | issues: " + "; ".join(self.issues)
        if self.warnings:
            msg += " | warnings: " + "; ".join(self.warnings)
        return msg


def validate_frame(df: pd.DataFrame, name: str, require_port: bool = True,
                   require_date: bool = True) -> ValidationReport:
    rep = ValidationReport(name=name, n_rows=len(df))

    if df.empty:
        rep.warnings.append("frame is empty (downstream will use fallbacks)")
        return rep

    if require_port and PORT_ID not in df.columns:
        rep.issues.append(f"missing '{PORT_ID}' column")
    if require_date and DATE not in df.columns:
        rep.issues.append(f"missing '{DATE}' column")

    # Date parse + range
    if require_date and DATE in df.columns:
        dates = pd.to_datetime(df[DATE], errors="coerce")
        n_bad = int(dates.isna().sum())
        if n_bad:
            rep.warnings.append(f"{n_bad} unparseable dates")
        else:
            rep.warnings.append(f"date range {dates.min().date()}..{dates.max().date()}")

    # Duplicate keys
    if require_port and require_date and {PORT_ID, DATE} <= set(df.columns):
        dups = int(df.duplicated(subset=[PORT_ID, DATE]).sum())
        if dups:
            rep.warnings.append(f"{dups} duplicate (port,date) rows")

    # All-NaN columns
    all_nan = [c for c in df.columns if df[c].isna().all()]
    if all_nan:
        rep.warnings.append(f"all-NaN columns: {all_nan}")

    return rep


def validate_bundle(bundle: Dict[str, pd.DataFrame]) -> Dict[str, ValidationReport]:
    """Validate every frame in a raw bundle and log a one-line summary each."""
    reports: Dict[str, ValidationReport] = {}
    for name, df in bundle.items():
        require_date = "trade_raw" != name  # trade is monthly (year/month cols)
        rep = validate_frame(df, name, require_port=True, require_date=require_date)
        reports[name] = rep
        log.info(rep.summary())
    return reports
