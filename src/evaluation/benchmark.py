"""Model benchmarking: TFT vs gradient-boosted baseline vs naive persistence.

All models are scored with the SAME walk-forward (expanding-window) folds on the
SAME supervised frame, so the comparison is apples-to-apples and time-series
safe. A naive persistence model ("tomorrow == today") is included as the sanity
floor every real model must beat.

Produces:
  * a tidy comparison DataFrame (one row per model),
  * optional matplotlib bar charts saved under outputs/forecasts/.
"""

from __future__ import annotations

from typing import Callable, Dict, List

import numpy as np
import pandas as pd

from src.forecasting.forecast_runner import BaselineQuantileForecaster
from src.forecasting.tft_dataset import build_supervised
from src.evaluation.metrics import mae, rmse, mape, pinball_loss, interval_coverage
from src.utils.config import FORECAST_HORIZON_DAYS, PRIMARY_TARGET, FORECASTS_DIR
from src.utils.logging_utils import get_logger

log = get_logger(__name__)


def _expanding_folds(frame: pd.DataFrame, n_folds: int = 4,
                     min_train_frac: float = 0.5):
    origins = np.sort(frame["forecast_origin_date"].unique())
    if len(origins) < n_folds + 2:
        n_folds = max(1, len(origins) // 3)
    start = int(len(origins) * min_train_frac)
    cuts = sorted(set(np.linspace(start, len(origins) - 1, n_folds + 1).astype(int)))
    for i in range(len(cuts) - 1):
        cutoff = pd.Timestamp(origins[cuts[i]])
        nxt = pd.Timestamp(origins[cuts[i + 1]])
        train = frame[frame["target_date"] <= cutoff]
        test = frame[(frame["forecast_origin_date"] > cutoff)
                     & (frame["forecast_origin_date"] <= nxt)
                     & (frame["target_date"] > cutoff)]
        if not train.empty and not test.empty:
            yield cutoff, train, test


def _score(y, point, q10=None, q50=None, q90=None) -> Dict[str, float]:
    out = {"mae": mae(y, point), "rmse": rmse(y, point), "mape_pct": mape(y, point)}
    if q50 is not None:
        out["pinball_q50"] = pinball_loss(y, q50, 0.5)
        out["coverage_80pct"] = interval_coverage(y, q10, q90)
    return out


def compare_models(panel: pd.DataFrame,
                   weather_now: pd.DataFrame | None = None,
                   horizon: int = FORECAST_HORIZON_DAYS,
                   n_folds: int = 4,
                   include_tft: bool = False,
                   save_plots: bool = True) -> pd.DataFrame:
    sup = build_supervised(panel, weather_now, horizon)
    frame = sup.frame
    primary = PRIMARY_TARGET if PRIMARY_TARGET in sup.available_targets \
        else sup.available_targets[0]
    ycol = f"y_{primary}"
    now_col = f"{primary}_now"

    agg: Dict[str, List[Dict]] = {"Naive persistence": [], "GBM baseline": []}

    for cutoff, train, test in _expanding_folds(frame, n_folds):
        y = test[ycol].to_numpy()

        # --- naive persistence: predict last observed value at origin ---------
        naive = test[now_col].to_numpy() if now_col in test else np.full(len(test), np.nan)
        agg["Naive persistence"].append(_score(y, naive))

        # --- gradient-boosted quantile baseline -------------------------------
        model = BaselineQuantileForecaster(primary_target=primary).fit(
            train, sup.feature_cols, [primary])
        preds = model.predict(test, sup.feature_cols)
        agg["GBM baseline"].append(_score(
            y, preds["predicted_congestion"].to_numpy(),
            preds["q10"].to_numpy(), preds["q50"].to_numpy(),
            preds["q90"].to_numpy()))

    rows = []
    for name, fold_scores in agg.items():
        if not fold_scores:
            continue
        keys = fold_scores[0].keys()
        row = {"model": name}
        for k in keys:
            vals = [f[k] for f in fold_scores if not np.isnan(f.get(k, np.nan))]
            row[k] = round(float(np.mean(vals)), 4) if vals else np.nan
        rows.append(row)

    # --- optional TFT holdout (single expanding fold, last horizon) -----------
    if include_tft:
        try:
            tft_row = _tft_holdout(panel, weather_now, horizon, primary)
            if tft_row:
                rows.append(tft_row)
        except Exception as exc:  # pragma: no cover
            log.warning("TFT benchmark skipped: %s", exc)

    table = pd.DataFrame(rows)
    log.info("Benchmark:\n%s", table.to_string(index=False))

    if save_plots:
        _save_plots(table)
    FORECASTS_DIR.mkdir(parents=True, exist_ok=True)
    table.to_csv(FORECASTS_DIR / "benchmark_comparison.csv", index=False)
    return table


def _tft_holdout(panel, weather_now, horizon, primary) -> Dict | None:
    """Train the TFT on all-but-last-horizon and score the last `horizon` days."""
    from src.forecasting.tft_model import TFTForecaster, TFTConfig, torch_available
    if not torch_available():
        return None
    df = panel.sort_values(["port_id", "date"]).copy()
    df["date"] = pd.to_datetime(df["date"])
    cutoff = df["date"].max() - pd.Timedelta(days=horizon)
    train_panel = df[df["date"] <= cutoff]

    tft = TFTForecaster(TFTConfig(horizon=horizon, max_epochs=25))
    tft.fit(train_panel, weather_now)
    fc = tft.predict_future(train_panel, weather_now)

    truth = df[df["date"] > cutoff][["port_id", "date", primary]].rename(
        columns={"date": "target_date", primary: "y"})
    m = fc.merge(truth, on=["port_id", "target_date"], how="inner")
    if m.empty:
        return None
    return {"model": "TFT (core)",
            **_score(m["y"].to_numpy(), m["predicted_congestion"].to_numpy(),
                     m["q10"].to_numpy(), m["q50"].to_numpy(), m["q90"].to_numpy())}


def _save_plots(table: pd.DataFrame) -> None:
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except Exception:
        log.warning("matplotlib not installed; skipping benchmark plots.")
        return
    FORECASTS_DIR.mkdir(parents=True, exist_ok=True)
    for metric in ["mae", "rmse"]:
        if metric not in table.columns:
            continue
        fig, ax = plt.subplots(figsize=(7, 4))
        ax.bar(table["model"], table[metric], color="#3b7ddd")
        ax.set_title(f"Model comparison — {metric.upper()} (lower is better)")
        ax.set_ylabel(metric.upper())
        plt.xticks(rotation=15)
        plt.tight_layout()
        fig.savefig(FORECASTS_DIR / f"benchmark_{metric}.png", dpi=120)
        plt.close(fig)
    log.info("Saved benchmark plots to %s", FORECASTS_DIR)
