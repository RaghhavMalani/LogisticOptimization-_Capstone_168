from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

from backend.training.build_dataset import build_dataset


DEFAULT_FEATURES = ["WxImpactIndex", "queue_proxy", "demand_pressure", "macro_pressure", "geo_risk_score"]


def train_forecast_model(data: pd.DataFrame, target: str) -> HistGradientBoostingRegressor:
  usable = [feature for feature in DEFAULT_FEATURES if feature in data.columns]
  if not usable:
    raise ValueError("No forecast features found in dataset.")
  if target not in data.columns:
    raise ValueError(f"Target {target!r} not found.")
  train = data.dropna(subset=[target]).copy()
  matrix = train[usable].fillna(train[usable].median(numeric_only=True))
  model = HistGradientBoostingRegressor(max_leaf_nodes=16, learning_rate=0.06, random_state=42)
  model.fit(matrix, train[target])
  return model


def main() -> None:
  parser = argparse.ArgumentParser(description="Train deterministic baseline forecast model.")
  parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[2])
  parser.add_argument("--target", default="congestion_index")
  parser.add_argument("--cutoff", default="2026-05-31")
  args = parser.parse_args()

  data = build_dataset(args.repo_root)
  train = data[data["date"] <= pd.Timestamp(args.cutoff)].copy()
  model = train_forecast_model(train, args.target)
  print({"model": type(model).__name__, "trainRows": len(train), "target": args.target})


if __name__ == "__main__":
  main()
