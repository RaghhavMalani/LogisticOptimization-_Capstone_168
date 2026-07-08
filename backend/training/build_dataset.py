from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd


def build_dataset(repo_root: Path) -> pd.DataFrame:
  panel_path = repo_root / "outputs" / "expert_features" / "merged_panel.csv"
  if panel_path.exists():
    data = pd.read_csv(panel_path, parse_dates=["date"])
  else:
    observed = pd.read_csv(repo_root / "data" / "sample" / "observed.csv", parse_dates=["Date"])
    data = observed.rename(columns={"Date": "date"})

  required = {"port_id", "date"}
  missing = required - set(data.columns)
  if missing:
    raise ValueError(f"Dataset missing required columns: {sorted(missing)}")

  return data.sort_values(["port_id", "date"]).reset_index(drop=True)


def main() -> None:
  parser = argparse.ArgumentParser(description="Build leakage-safe PortWatch training panel.")
  parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[2])
  parser.add_argument("--out", type=Path, default=Path("outputs/training/training_panel.csv"))
  args = parser.parse_args()

  data = build_dataset(args.repo_root)
  output = args.repo_root / args.out
  output.parent.mkdir(parents=True, exist_ok=True)
  data.to_csv(output, index=False)
  print(f"Wrote {len(data):,} rows to {output}")


if __name__ == "__main__":
  main()
