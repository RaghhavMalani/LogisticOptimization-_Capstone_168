from __future__ import annotations

import numpy as np


def mae(y_true, y_pred) -> float:
  values = np.asarray(y_true, dtype=float) - np.asarray(y_pred, dtype=float)
  return float(np.mean(np.abs(values)))


def rmse(y_true, y_pred) -> float:
  values = np.asarray(y_true, dtype=float) - np.asarray(y_pred, dtype=float)
  return float(np.sqrt(np.mean(values ** 2)))


def pinball_loss(y_true, y_pred, quantile: float) -> float:
  truth = np.asarray(y_true, dtype=float)
  pred = np.asarray(y_pred, dtype=float)
  error = truth - pred
  return float(np.mean(np.maximum(quantile * error, (quantile - 1) * error)))


def coverage(y_true, lower, upper) -> float:
  truth = np.asarray(y_true, dtype=float)
  lo = np.asarray(lower, dtype=float)
  hi = np.asarray(upper, dtype=float)
  return float(np.mean((truth >= lo) & (truth <= hi)))
