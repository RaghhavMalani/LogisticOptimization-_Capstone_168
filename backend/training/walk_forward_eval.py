from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from backend.training.build_dataset import build_dataset
from backend.training.metrics import mae, rmse


def time_split(data: pd.DataFrame, cutoff: str) -> tuple[pd.DataFrame, pd.DataFrame]:
  cutoff_ts = pd.Timestamp(cutoff)
  train = data[data["date"] <= cutoff_ts].copy()
  test = data[data["date"] > cutoff_ts].copy()
  if train.empty or test.empty:
    raise ValueError("Time split produced an empty train or test set.")
  return train, test


def evaluate_baseline(data: pd.DataFrame, target: str, cutoff: str) -> dict[str, float]:
  train, test = time_split(data, cutoff)
  by_port = train.groupby("port_id")[target].median()
  global_median = float(train[target].median())
  predictions = test["port_id"].map(by_port).fillna(global_median)
  return {
    "mae": mae(test[target], predictions),
    "rmse": rmse(test[target], predictions),
    "trainRows": float(len(train)),
    "testRows": float(len(test)),
  }


def main() -> None:
  parser = argparse.ArgumentParser(description="Run time-based walk-forward baseline evaluation.")
  parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[2])
  parser.add_argument("--target", default="congestion_index")
  parser.add_argument("--cutoff", default="2026-05-31")
  args = parser.parse_args()

  data = build_dataset(args.repo_root)
  if args.target not in data.columns:
    raise ValueError(f"Target {args.target!r} not found in dataset columns.")
  result = evaluate_baseline(data, args.target, args.cutoff)
  print(result)


if __name__ == "__main__":
  main()
