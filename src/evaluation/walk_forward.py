"""Walk-forward (expanding-window) validation.

Random train/test splits leak the future into the past and are invalid for time
series. Instead we expand the training window and forecast the *next* block of
origins, e.g.:

    Train on days 1-60   -> forecast days 61-70
    Train on days 1-70   -> forecast days 71-80
    Train on days 1-80   -> forecast days 81-90

Leakage control: a training example is only used if its **label is observed by
the fold cutoff** (target_date <= cutoff). Test examples are those whose
forecast origin falls in the next window and whose target is after the cutoff.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List

import numpy as np
import pandas as pd

from src.forecasting.forecast_runner import BaselineQuantileForecaster
from src.forecasting.tft_dataset import build_supervised
from src.utils.config import FORECAST_HORIZON_DAYS, PRIMARY_TARGET
from src.evaluation.metrics import quantile_report, regression_report
from src.utils.logging_utils import get_logger

log = get_logger(__name__)


@dataclass
class WalkForwardResult:
    fold_metrics: pd.DataFrame
    overall: Dict[str, object]
    predictions: pd.DataFrame
    folds: List[Dict] = field(default_factory=list)


def walk_forward_validate(panel: pd.DataFrame,
                          weather_now: pd.DataFrame | None = None,
                          horizon: int = FORECAST_HORIZON_DAYS,
                          n_folds: int = 4,
                          min_train_frac: float = 0.5) -> WalkForwardResult:
    sup = build_supervised(panel, weather_now, horizon)
    frame = sup.frame.copy()
    primary = PRIMARY_TARGET if PRIMARY_TARGET in sup.available_targets \
        else sup.available_targets[0]
    ycol = f"y_{primary}"

    origins = np.sort(frame["forecast_origin_date"].unique())
    if len(origins) < n_folds + 2:
        log.warning("Not enough origins for %d folds; reducing.", n_folds)
        n_folds = max(1, len(origins) // 3)

    start_idx = int(len(origins) * min_train_frac)
    cut_indices = np.linspace(start_idx, len(origins) - 1, n_folds + 1).astype(int)
    cut_indices = sorted(set(cut_indices))

    all_preds = []
    fold_rows = []
    for i in range(len(cut_indices) - 1):
        cutoff = pd.Timestamp(origins[cut_indices[i]])
        next_cut = pd.Timestamp(origins[cut_indices[i + 1]])

        # leakage-safe training: labels observed by cutoff
        train = frame[frame["target_date"] <= cutoff]
        test = frame[(frame["forecast_origin_date"] > cutoff)
                     & (frame["forecast_origin_date"] <= next_cut)
                     & (frame["target_date"] > cutoff)]
        if train.empty or test.empty:
            continue

        # Validation only scores the primary target, so train only its models
        # (q10/q50/q90). This makes walk-forward dramatically faster.
        model = BaselineQuantileForecaster(primary_target=primary).fit(
            train, sup.feature_cols, [primary])
        preds = model.predict(test, sup.feature_cols)

        # join the true primary label for scoring
        truth = test[["port_id", "forecast_origin_date", "target_date", ycol]]
        merged = preds.merge(truth, on=["port_id", "forecast_origin_date",
                                        "target_date"], how="left")
        merged["fold"] = i
        all_preds.append(merged)

        reg = regression_report(merged[ycol], merged["predicted_congestion"])
        qr = quantile_report(merged[ycol], merged["q10"], merged["q50"], merged["q90"])

        # conformal calibration: split train, derive offset, re-measure coverage
        from src.forecasting.calibration import conformal_offset, apply_offset
        from src.evaluation.metrics import interval_coverage
        tcut = train["forecast_origin_date"].quantile(0.8)
        tr2 = train[train["target_date"] <= tcut]
        cal = train[train["forecast_origin_date"] > tcut]
        Q = 0.0
        if not tr2.empty and not cal.empty:
            cm = BaselineQuantileForecaster(primary_target=primary).fit(
                tr2, sup.feature_cols, [primary])
            cp = cm.predict(cal, sup.feature_cols)
            Q = conformal_offset(cal[ycol], cp["q10"], cp["q90"], alpha=0.2)
        lo, hi = apply_offset(merged["q10"], merged["q90"], Q)
        cov_cal = interval_coverage(merged[ycol], lo, hi)

        fold_rows.append({"fold": i, "train_end": cutoff.date(),
                          "test_end": next_cut.date(), "n_test": len(merged),
                          **reg, **qr, "conformal_offset": round(Q, 2),
                          "coverage_80pct_cal": round(cov_cal, 4)})
        log.info("Fold %d | train<=%s | n_test=%d | MAE=%.3f | cov80 raw=%.2f cal=%.2f",
                 i, cutoff.date(), len(merged), reg["mae"],
                 qr["coverage_80pct"], cov_cal)

    fold_metrics = pd.DataFrame(fold_rows)
    predictions = (pd.concat(all_preds, ignore_index=True)
                   if all_preds else pd.DataFrame())

    overall = {}
    if not predictions.empty:
        overall = {
            "primary_target": primary,
            "n_folds": int(fold_metrics["fold"].nunique()),
            "n_predictions": int(len(predictions)),
            **{f"mean_{k}": round(float(fold_metrics[k].mean()), 4)
               for k in ["mae", "rmse", "mape_pct", "pinball_q50",
                         "coverage_80pct", "coverage_80pct_cal"]
               if k in fold_metrics},
        }
    return WalkForwardResult(fold_metrics=fold_metrics, overall=overall,
                             predictions=predictions)
