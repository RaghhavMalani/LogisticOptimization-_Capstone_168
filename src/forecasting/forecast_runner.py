"""Baseline quantile forecaster + final forecast-table assembly.

The TFT (tft_model.py) is the intended core model, but it needs a heavy DL
environment. This module is the always-available fallback: a gradient-boosted
*quantile* regressor that produces q10/q50/q90 for the primary target and point
(q50) forecasts for the secondary targets, then packages everything into the
exact forecast schema the dashboard and user-output layer expect.

Forecast table columns (per the project spec)
---------------------------------------------
    port_id, forecast_origin_date, target_date, horizon_day,
    predicted_congestion, predicted_delay, predicted_throughput,
    q10, q50, q90, risk_level, confidence_score

Everything here is leakage-safe by construction: it consumes the supervised /
inference frames from tft_dataset, where features are known at the forecast
origin and the only future value used (in training) is the label.
"""

from __future__ import annotations

from typing import Dict, List

import numpy as np
import pandas as pd

from src.forecasting.tft_dataset import (
    SupervisedData,
    build_inference,
    build_supervised,
)
from src.utils.config import (
    FORECAST_HORIZON_DAYS,
    PORT_ID,
    PRIMARY_TARGET,
    QUANTILES,
)
from src.utils.logging_utils import get_logger

log = get_logger(__name__)


def _sklearn_available() -> bool:
    try:
        from sklearn.ensemble import GradientBoostingRegressor  # noqa: F401
        return True
    except Exception:
        return False


class BaselineQuantileForecaster:
    """Direct multi-horizon GBM quantile forecaster (one model per target/quantile).

    `horizon_day` is a feature, so a single model covers all 1..10 day horizons
    (the "direct" multi-horizon strategy).
    """

    def __init__(self, quantiles: List[float] = None,
                 primary_target: str = PRIMARY_TARGET):
        self.quantiles = quantiles or QUANTILES
        self.primary_target = primary_target
        self.models: Dict[str, object] = {}
        self.fallback_means: Dict[str, float] = {}
        self.available_targets: List[str] = []
        self.use_sklearn = _sklearn_available()

    def _new_gbm(self, alpha: float):
        # HistGradientBoostingRegressor is much faster on large frames and
        # supports native quantile loss + early stopping. Fall back to the
        # classic GBM only if it is unavailable.
        try:
            from sklearn.ensemble import HistGradientBoostingRegressor
            return HistGradientBoostingRegressor(
                loss="quantile", quantile=alpha, max_iter=300, max_depth=3,
                learning_rate=0.05, early_stopping=True, validation_fraction=0.1,
                n_iter_no_change=15, random_state=42)
        except Exception:  # pragma: no cover - very old sklearn
            from sklearn.ensemble import GradientBoostingRegressor
            return GradientBoostingRegressor(
                loss="quantile", alpha=alpha, n_estimators=200, max_depth=3,
                learning_rate=0.05, subsample=0.9, random_state=42)

    def fit(self, train_frame: pd.DataFrame, feature_cols: List[str],
            available_targets: List[str]) -> "BaselineQuantileForecaster":
        self.available_targets = available_targets
        X = train_frame[feature_cols].to_numpy(dtype=float)

        for tgt in available_targets:
            ycol = f"y_{tgt}"
            mask = train_frame[ycol].notna()
            y = train_frame.loc[mask, ycol].to_numpy(dtype=float)
            self.fallback_means[tgt] = float(np.nanmean(y)) if len(y) else 0.0
            if not self.use_sklearn or len(y) < 30:
                if not self.use_sklearn:
                    log.warning("scikit-learn unavailable; using persistence/mean fallback.")
                continue
            Xt = X[mask.to_numpy()]
            # primary target gets all quantiles; others get the median only
            qs = self.quantiles if tgt == self.primary_target else [0.5]
            for q in qs:
                m = self._new_gbm(q)
                m.fit(Xt, y)
                self.models[f"{tgt}|{q}"] = m
        return self

    def _predict_one(self, key: str, X: np.ndarray, target: str) -> np.ndarray:
        if key in self.models:
            return self.models[key].predict(X)
        # Fallback: persistence (use the target's "_now" if present) else mean.
        return np.full(X.shape[0], self.fallback_means.get(target, 0.0))

    def predict(self, frame: pd.DataFrame, feature_cols: List[str]) -> pd.DataFrame:
        X = frame[feature_cols].to_numpy(dtype=float)
        out = frame[[PORT_ID, "forecast_origin_date", "target_date",
                     "horizon_day"]].copy()

        # Primary target quantiles.
        pt = self.primary_target if self.primary_target in self.available_targets \
            else (self.available_targets[0] if self.available_targets else None)

        # Persistence fallback value (last observed) when no model:
        now_col = f"{pt}_now" if pt and f"{pt}_now" in frame.columns else None
        persist = frame[now_col].to_numpy() if now_col else None

        def q_pred(q):
            key = f"{pt}|{q}"
            if key in self.models:
                return self._predict_one(key, X, pt)
            return persist if persist is not None else \
                np.full(len(frame), self.fallback_means.get(pt, 0.0))

        q10 = q_pred(0.1)
        q50 = q_pred(0.5)
        q90 = q_pred(0.9)
        # enforce monotonic quantiles row-wise
        stacked = np.sort(np.vstack([q10, q50, q90]), axis=0)
        out["q10"], out["q50"], out["q90"] = stacked[0], stacked[1], stacked[2]

        # Point forecasts per target (q50).
        for tgt, colname in [("congestion_index", "predicted_congestion"),
                             ("delay_hours", "predicted_delay"),
                             ("throughput", "predicted_throughput")]:
            if tgt in self.available_targets:
                key = f"{tgt}|0.5"
                if key in self.models:
                    out[colname] = self._predict_one(key, X, tgt)
                elif tgt == pt:
                    out[colname] = out["q50"]
                else:
                    nc = f"{tgt}_now"
                    out[colname] = (frame[nc].to_numpy() if nc in frame.columns
                                    else self.fallback_means.get(tgt, 0.0))
            else:
                out[colname] = np.nan

        out = _add_risk_and_confidence(out, frame)
        round_cols = ["q10", "q50", "q90", "predicted_congestion",
                      "predicted_delay", "predicted_throughput", "confidence_score"]
        for c in round_cols:
            out[c] = pd.to_numeric(out[c], errors="coerce").round(3)
        return out.reset_index(drop=True)


# ---------------------------------------------------------------------------
# Risk level + confidence
# ---------------------------------------------------------------------------
def _add_risk_and_confidence(out: pd.DataFrame, frame: pd.DataFrame) -> pd.DataFrame:
    cong = out["predicted_congestion"].to_numpy(dtype=float)
    q90 = out["q90"].to_numpy(dtype=float)

    # Risk level on the 0..100 congestion scale, escalated by the upper tail.
    def level(p, hi):
        if p >= 60 or hi >= 75:
            return "High"
        if p >= 40 or hi >= 55:
            return "Medium"
        return "Low"
    out["risk_level"] = [level(p, h) for p, h in zip(cong, q90)]

    # Confidence: narrow interval + near horizon + good regime confidence.
    width = (out["q90"] - out["q10"]).to_numpy(dtype=float)
    width_term = np.clip(1.0 - width / 60.0, 0.1, 1.0)       # 60 = reference span
    horizon_term = 1.0 - 0.03 * out["horizon_day"].to_numpy(dtype=float)
    if "regime_confidence" in frame.columns:
        regime_term = 0.5 + 0.5 * frame["regime_confidence"].to_numpy(dtype=float)
    else:
        regime_term = 1.0
    conf = np.clip(width_term * horizon_term * regime_term, 0.05, 0.97)
    out["confidence_score"] = conf
    return out


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------
def fit_baseline(train: SupervisedData) -> BaselineQuantileForecaster:
    return BaselineQuantileForecaster().fit(
        train.frame, train.feature_cols, train.available_targets)


def run_baseline(panel: pd.DataFrame,
                 weather_now: pd.DataFrame | None = None,
                 horizon: int = FORECAST_HORIZON_DAYS) -> pd.DataFrame:
    """Train on all labeled history, then emit a live 1..H day forecast from the
    latest available origin per port.
    """
    sup = build_supervised(panel, weather_now, horizon)
    model = fit_baseline(sup)
    inf = build_inference(panel, weather_now, horizon)
    forecast = model.predict(inf.frame, inf.feature_cols)
    forecast["model"] = "baseline"

    Q = _conformal_offset_from(sup)
    if Q != 0.0:
        from src.forecasting.calibration import apply_offset
        lo, hi = apply_offset(forecast["q10"], forecast["q90"], Q)
        forecast["q10"], forecast["q90"] = lo.round(3), hi.round(3)
        forecast["conformal_offset"] = round(Q, 2)

    log.info("Baseline forecast produced: %d rows (%d ports x %d horizons); "
             "conformal offset=%.2f.", len(forecast), forecast[PORT_ID].nunique(),
             horizon, Q)
    return forecast


def _conformal_offset_from(sup, primary: str = None, alpha: float = 0.2) -> float:
    """Fit on the first 80% of origins, calibrate the 80% interval on the rest."""
    from src.forecasting.calibration import conformal_offset
    primary = primary or (PRIMARY_TARGET if PRIMARY_TARGET in sup.available_targets
                          else (sup.available_targets[0] if sup.available_targets else None))
    if primary is None:
        return 0.0
    frame = sup.frame.sort_values("forecast_origin_date")
    cut = frame["forecast_origin_date"].quantile(0.8)
    train = frame[frame["target_date"] <= cut]
    calib = frame[frame["forecast_origin_date"] > cut]
    if train.empty or calib.empty:
        return 0.0
    try:
        m = BaselineQuantileForecaster(primary_target=primary).fit(
            train, sup.feature_cols, [primary])
        preds = m.predict(calib, sup.feature_cols)
        return conformal_offset(calib[f"y_{primary}"], preds["q10"], preds["q90"], alpha)
    except Exception:  # pragma: no cover
        return 0.0


# ---------------------------------------------------------------------------
# Model selector: TFT (core) with baseline for secondary targets + fallback
# ---------------------------------------------------------------------------
def generate_forecast(panel: pd.DataFrame,
                      weather_now: pd.DataFrame | None = None,
                      horizon: int = FORECAST_HORIZON_DAYS,
                      model: str = "auto",
                      tft_max_epochs: int = 40) -> pd.DataFrame:
    """Produce the live forecast table using the requested model.

    model = "tft"      -> train+use the real TFT for the primary target
                          (raises if torch is unavailable).
    model = "baseline" -> the gradient-boosted quantile baseline only.
    model = "auto"     -> use the TFT if torch is importable, else the baseline;
                          any TFT error falls back to the baseline.

    In TFT mode the secondary targets (delay/throughput) are filled from the
    baseline so the downstream schema is always complete (a clean hybrid).
    """
    model = model.lower()
    if model == "baseline":
        return run_baseline(panel, weather_now, horizon)

    from src.forecasting.tft_model import TFTForecaster, TFTConfig, torch_available
    if model in ("tft", "auto") and torch_available():
        try:
            log.info("Forecasting with the TFT core model (%s mode).", model)
            tft = TFTForecaster(TFTConfig(horizon=horizon, max_epochs=tft_max_epochs))
            tft.fit(panel, weather_now)
            tft_fc = tft.predict_future(panel, weather_now)
            tft_fc["model"] = "tft"
            # hybrid: fill secondary point targets from the baseline
            base = run_baseline(panel, weather_now, horizon)
            tft_fc = _merge_secondary(tft_fc, base)
            log.info("TFT forecast produced: %d rows.", len(tft_fc))
            return tft_fc
        except Exception as exc:
            log.warning("TFT path failed (%s); falling back to baseline.", exc)
            return run_baseline(panel, weather_now, horizon)

    if model == "tft":
        log.warning("TFT requested but torch/pytorch-forecasting not installed; "
                    "falling back to the baseline forecaster. Install "
                    "-r requirements-tft.txt to train the real TFT.")
    else:
        log.info("torch not available; using baseline forecaster.")
    return run_baseline(panel, weather_now, horizon)


def _merge_secondary(tft_fc: pd.DataFrame, base: pd.DataFrame) -> pd.DataFrame:
    """Copy baseline's predicted_delay/throughput onto the TFT table (matched by
    port_id + horizon_day, since both forecast the same live origin)."""
    cols = ["predicted_delay", "predicted_throughput"]
    keep = [PORT_ID, "horizon_day"] + [c for c in cols if c in base.columns]
    merged = tft_fc.drop(columns=[c for c in cols if c in tft_fc.columns],
                         errors="ignore").merge(
        base[keep], on=[PORT_ID, "horizon_day"], how="left")
    return merged
