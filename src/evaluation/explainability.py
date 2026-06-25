"""Model explainability.

Two complementary views:
  * `baseline_feature_importance` -- permutation importance on the gradient-
    boosted baseline (model-agnostic, always available). Answers "which inputs
    move the congestion forecast?".
  * `tft_variable_importance`     -- the TFT's own learned variable-selection
    weights (encoder/decoder/static), exposed via the model's interpret_output.

Both return tidy DataFrames and can save a bar chart, so the results drop
straight into the dashboard or the report.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from src.forecasting.forecast_runner import BaselineQuantileForecaster
from src.forecasting.tft_dataset import build_supervised
from src.utils.config import FORECASTS_DIR, PRIMARY_TARGET
from src.utils.logging_utils import get_logger

log = get_logger(__name__)


def baseline_feature_importance(panel: pd.DataFrame,
                                weather_now: pd.DataFrame | None = None,
                                horizon: int = 10, top_n: int = 20,
                                save_plot: bool = True) -> pd.DataFrame:
    from sklearn.inspection import permutation_importance

    sup = build_supervised(panel, weather_now, horizon)
    primary = PRIMARY_TARGET if PRIMARY_TARGET in sup.available_targets \
        else sup.available_targets[0]
    frame = sup.frame.sort_values("forecast_origin_date")

    # time-ordered split so importance is measured on a held-out tail
    split = int(len(frame) * 0.8)
    train, test = frame.iloc[:split], frame.iloc[split:]

    model = BaselineQuantileForecaster(primary_target=primary).fit(
        train, sup.feature_cols, [primary])
    est = model.models.get(f"{primary}|0.5")
    if est is None:
        log.warning("No median model available for importance.")
        return pd.DataFrame()

    X_test = test[sup.feature_cols].to_numpy(dtype=float)
    y_test = test[f"y_{primary}"].to_numpy(dtype=float)
    mask = ~np.isnan(y_test)
    result = permutation_importance(est, X_test[mask], y_test[mask],
                                    n_repeats=8, random_state=42, n_jobs=1)
    imp = (pd.DataFrame({"feature": sup.feature_cols,
                         "importance": result.importances_mean,
                         "std": result.importances_std})
           .sort_values("importance", ascending=False)
           .head(top_n).reset_index(drop=True))

    if save_plot:
        _save_importance_plot(imp, "baseline_feature_importance",
                              "Baseline permutation importance")
    FORECASTS_DIR.mkdir(parents=True, exist_ok=True)
    imp.to_csv(FORECASTS_DIR / "baseline_feature_importance.csv", index=False)
    log.info("Top features: %s", imp["feature"].head(8).tolist())
    return imp


def tft_variable_importance(tft) -> dict:
    """Pass-through to the TFT's learned variable-selection weights."""
    try:
        vi = tft.variable_importance()
        if vi:
            FORECASTS_DIR.mkdir(parents=True, exist_ok=True)
            import json
            with open(FORECASTS_DIR / "tft_variable_importance.json", "w") as fh:
                json.dump(vi, fh, indent=2, default=str)
        return vi
    except Exception as exc:  # pragma: no cover
        log.warning("TFT variable importance unavailable: %s", exc)
        return {}


def _save_importance_plot(imp: pd.DataFrame, fname: str, title: str) -> None:
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except Exception:
        return
    fig, ax = plt.subplots(figsize=(8, max(4, 0.35 * len(imp))))
    ax.barh(imp["feature"][::-1], imp["importance"][::-1], color="#2ca25f")
    ax.set_title(title)
    ax.set_xlabel("Permutation importance (Δ error)")
    plt.tight_layout()
    fig.savefig(FORECASTS_DIR / f"{fname}.png", dpi=120)
    plt.close(fig)
