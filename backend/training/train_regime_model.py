from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd
from sklearn.mixture import GaussianMixture

from backend.training.build_dataset import build_dataset


DEFAULT_FEATURES = ["congestion_index", "delay_hours", "throughput", "WxImpactIndex", "queue_proxy"]


def train_regime_model(data: pd.DataFrame, features: list[str]) -> GaussianMixture:
  usable = [feature for feature in features if feature in data.columns]
  if len(usable) < 2:
    raise ValueError("Need at least two available features for regime training.")
  matrix = data[usable].fillna(data[usable].median(numeric_only=True))
  model = GaussianMixture(n_components=3, covariance_type="full", random_state=42)
  model.fit(matrix)
  return model


def main() -> None:
  parser = argparse.ArgumentParser(description="Train leakage-safe regime clustering model.")
  parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[2])
  parser.add_argument("--cutoff", default="2026-05-31")
  args = parser.parse_args()

  data = build_dataset(args.repo_root)
  train = data[data["date"] <= pd.Timestamp(args.cutoff)].copy()
  model = train_regime_model(train, DEFAULT_FEATURES)
  print({"components": int(model.n_components), "trainRows": len(train), "features": DEFAULT_FEATURES})


if __name__ == "__main__":
  main()
