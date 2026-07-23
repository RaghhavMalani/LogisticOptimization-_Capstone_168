from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
PROCESSED_DIR = ROOT / "data" / "processed"

INPUT_CSV = PROCESSED_DIR / "features_daily.csv"
OUTPUT_CSV = PROCESSED_DIR / "features_daily_hsmm.csv"
OUTPUT_PARQUET = PROCESSED_DIR / "features_daily_hsmm.parquet"
REGIME_CSV = PROCESSED_DIR / "hsmm_regimes.csv"

REGIME_LABELS = ["NORMAL", "CONGESTED", "SEVERE"]


def mode_smooth(labels: np.ndarray, window: int = 3) -> np.ndarray:
    if len(labels) <= window:
        return labels

    out = labels.copy()
    half = window // 2

    for i in range(len(labels)):
        lo = max(0, i - half)
        hi = min(len(labels), i + half + 1)
        vals, counts = np.unique(labels[lo:hi], return_counts=True)
        out[i] = vals[np.argmax(counts)]

    return out


def run_lengths(labels: np.ndarray) -> np.ndarray:
    out = np.ones(len(labels), dtype=int)

    for i in range(1, len(labels)):
        if labels[i] == labels[i - 1]:
            out[i] = out[i - 1] + 1
        else:
            out[i] = 1

    return out


def collect_sojourns(labels: np.ndarray, ports: np.ndarray) -> dict[int, list[int]]:
    runs = {0: [], 1: [], 2: []}

    for port in pd.unique(ports):
        seq = labels[ports == port]
        if len(seq) == 0:
            continue

        cur = seq[0]
        length = 1

        for x in seq[1:]:
            if x == cur:
                length += 1
            else:
                runs[int(cur)].append(length)
                cur = x
                length = 1

        runs[int(cur)].append(length)

    for k in runs:
        if not runs[k]:
            runs[k] = [2]

    return runs


def expected_remaining(regime: int, days_in_state: int, sojourns: dict[int, list[int]]) -> float:
    runs = np.array(sojourns.get(int(regime), [2]), dtype=float)
    longer = runs[runs > days_in_state]

    if len(longer):
        return float(np.mean(longer - days_in_state))

    return 1.0


def estimate_transition_matrix(labels: np.ndarray, ports: np.ndarray) -> np.ndarray:
    mat = np.ones((3, 3), dtype=float)

    for port in pd.unique(ports):
        seq = labels[ports == port]
        for a, b in zip(seq[:-1], seq[1:]):
            mat[int(a), int(b)] += 1.0

    return mat / mat.sum(axis=1, keepdims=True)


def main() -> None:
    if not INPUT_CSV.exists():
        raise FileNotFoundError(f"Missing {INPUT_CSV}. Run build_features.py first.")

    df = pd.read_csv(INPUT_CSV)
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values(["port_id", "date"]).reset_index(drop=True)

    candidate_features = [
        "congestion_index",
        "delay_hours",
        "throughput_proxy",
        "wind_risk",
        "rain_risk",
        "wave_risk",
        "storm_risk",
        "weather_confidence",
        "news_sentiment_score",
        "news_rolling_risk",
        "demand_pressure",
        "trade_connectivity",
        "trade_trend",
    ]

    feature_cols = [c for c in candidate_features if c in df.columns]

    if "congestion_index" not in feature_cols:
        raise ValueError("congestion_index is required for regime ordering.")

    X = df[feature_cols].copy()
    X = X.replace([np.inf, -np.inf], np.nan)
    X = X.fillna(X.median(numeric_only=True)).fillna(0.0)

    try:
        from sklearn.mixture import GaussianMixture
        from sklearn.preprocessing import StandardScaler

        scaler = StandardScaler()
        Xs = scaler.fit_transform(X)

        model = GaussianMixture(
            n_components=3,
            covariance_type="full",
            random_state=42,
            n_init=5,
        )
        raw_states = model.fit_predict(Xs)
        raw_proba = model.predict_proba(Xs)
        backend = "GaussianMixture HSMM-style latent regime model"

    except Exception:
        # Safe fallback: if sklearn/GMM fails, use congestion quantile bands.
        q1, q2 = df["congestion_index"].quantile([0.33, 0.66])
        raw_states = np.select(
            [
                df["congestion_index"] <= q1,
                df["congestion_index"] <= q2,
            ],
            [0, 1],
            default=2,
        ).astype(int)

        raw_proba = np.zeros((len(df), 3), dtype=float)
        raw_proba[np.arange(len(df)), raw_states] = 1.0
        backend = "quantile fallback HSMM-style regime model"

    # Map raw latent states to NORMAL / CONGESTED / SEVERE by average congestion.
    state_means = {}
    for state in range(3):
        mask = raw_states == state
        state_means[state] = float(df.loc[mask, "congestion_index"].mean()) if mask.any() else float("inf")

    ordered_states = sorted(state_means, key=state_means.get)
    state_to_regime = {raw_state: rank for rank, raw_state in enumerate(ordered_states)}

    regime_codes = np.array([state_to_regime[int(s)] for s in raw_states], dtype=int)

    # Reorder probabilities into p_normal, p_congested, p_severe.
    regime_proba = np.zeros((len(df), 3), dtype=float)
    for raw_state, regime_code in state_to_regime.items():
        regime_proba[:, regime_code] += raw_proba[:, raw_state]

    # Smooth regimes per port to reduce 1-day jitter.
    smoothed = regime_codes.copy()
    for port in df["port_id"].unique():
        idx = df.index[df["port_id"] == port].to_numpy()
        smoothed[idx] = mode_smooth(regime_codes[idx], window=3)

    # Make hard labels and duration features.
    df["regime_code"] = smoothed
    df["regime_label"] = [REGIME_LABELS[i] for i in smoothed]

    df["p_normal"] = regime_proba[:, 0].round(4)
    df["p_congested"] = regime_proba[:, 1].round(4)
    df["p_severe"] = regime_proba[:, 2].round(4)
    df["regime_confidence"] = regime_proba.max(axis=1).round(4)

    ports = df["port_id"].to_numpy()
    transmat = estimate_transition_matrix(smoothed, ports)
    sojourns = collect_sojourns(smoothed, ports)

    days = np.zeros(len(df), dtype=int)
    expected = np.zeros(len(df), dtype=float)
    transition = np.zeros(len(df), dtype=float)

    for port in df["port_id"].unique():
        idx = df.index[df["port_id"] == port].to_numpy()
        seq = smoothed[idx]
        d = run_lengths(seq)
        days[idx] = d

        for local_i, global_i in enumerate(idx):
            cur = int(seq[local_i])
            expected[global_i] = expected_remaining(cur, int(d[local_i]), sojourns)
            transition[global_i] = 0.0 if cur == 2 else float(transmat[cur, cur + 1 :].sum())

    df["days_in_state"] = days
    df["expected_remaining_days"] = np.round(expected, 2)
    df["transition_risk"] = np.round(transition, 4)

    regime_cols = [
        "port_id",
        "date",
        "regime_label",
        "regime_code",
        "p_normal",
        "p_congested",
        "p_severe",
        "days_in_state",
        "expected_remaining_days",
        "transition_risk",
        "regime_confidence",
    ]

    regime_df = df[regime_cols].copy()
    regime_df["date"] = regime_df["date"].dt.strftime("%Y-%m-%d")

    out = df.copy()
    out["date"] = out["date"].dt.strftime("%Y-%m-%d")

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    out.to_csv(OUTPUT_CSV, index=False)
    regime_df.to_csv(REGIME_CSV, index=False)

    try:
        out.to_parquet(OUTPUT_PARQUET, index=False)
    except Exception:
        pass

    print(f"HSMM backend: {backend}")
    print(f"Input: {INPUT_CSV}")
    print(f"Output: {OUTPUT_CSV}")
    print(f"Regimes: {REGIME_CSV}")
    print("Regime counts:")
    print(regime_df["regime_label"].value_counts().to_string())
    print("Latest regime per port:")
    print(regime_df.sort_values("date").groupby("port_id").tail(1)[["port_id", "date", "regime_label", "regime_confidence"]].to_string(index=False))


if __name__ == "__main__":
    main()
