"""HSMM-style regime model (prototype).

A full Hidden *Semi*-Markov Model explicitly models state-duration
distributions. Rather than depend on a heavy/brittle HSMM library, this module
implements a practical, technically-defensible prototype that captures the same
behaviour the project needs:

  1. A latent state model over the expert/ops features:
        - GaussianHMM (hmmlearn) if installed -> gives soft posteriors and a
          transition matrix directly; otherwise
        - GaussianMixture (scikit-learn) -> soft posteriors, with the transition
          matrix estimated empirically from the decoded sequence.
  2. State -> regime mapping by ascending mean congestion
        (NORMAL < CONGESTED < SEVERE).
  3. Post-processing that adds the *semi-Markov / duration* information the spec
     asks for: days_in_state, expected_remaining_days (from the self-transition
     / empirical dwell), and transition_risk (probability of escalating to a
     more severe regime on the next step).

Output columns (per the project spec)
-------------------------------------
    port_id, date, regime_label,
    p_normal, p_congested, p_severe,
    days_in_state, expected_remaining_days,
    transition_risk, regime_confidence
"""

from __future__ import annotations

from typing import Dict, List

import numpy as np
import pandas as pd

from src.utils.config import (
    DATE,
    PORT_ID,
    RANDOM_SEED,
    REGIME_CONGESTED,
    REGIME_LABELS,
    REGIME_NORMAL,
    REGIME_ORDER,
    REGIME_SEVERE,
)
from src.regimes.regime_features import select_hsmm_matrix
from src.utils.logging_utils import get_logger

log = get_logger(__name__)

_OUT_COLS = [PORT_ID, DATE, "regime_label", "p_normal", "p_congested",
             "p_severe", "days_in_state", "expected_remaining_days",
             "transition_risk", "regime_confidence"]


def _try_import_hmmlearn():
    try:
        from hmmlearn.hmm import GaussianHMM  # type: ignore
        return GaussianHMM
    except Exception:
        return None


def _mode_smooth(labels: np.ndarray, window: int = 3) -> np.ndarray:
    """Majority-vote smoothing over a centred window to remove 1-day jitter."""
    n = len(labels)
    if n <= window:
        return labels
    out = labels.copy()
    half = window // 2
    for i in range(n):
        lo, hi = max(0, i - half), min(n, i + half + 1)
        vals, counts = np.unique(labels[lo:hi], return_counts=True)
        out[i] = vals[np.argmax(counts)]
    return out


def _run_lengths_so_far(label_seq: np.ndarray) -> np.ndarray:
    """days_in_state: consecutive count of the current label up to each index."""
    out = np.ones(len(label_seq), dtype=int)
    for i in range(1, len(label_seq)):
        out[i] = out[i - 1] + 1 if label_seq[i] == label_seq[i - 1] else 1
    return out


class HSMMRegimeModel:
    def __init__(self, n_states: int = 3, smooth_window: int = 3,
                 seed: int = RANDOM_SEED):
        self.n_states = n_states
        self.smooth_window = smooth_window
        self.seed = seed
        self.feature_names: List[str] = []
        self.scaler = None
        self.model = None
        self.backend = None              # "hmm" | "gmm"
        self.state_to_regime: Dict[int, str] = {}
        self.regime_to_state: Dict[str, int] = {}
        self.transmat_: np.ndarray | None = None     # over regimes (ordered)
        self.mean_duration_: Dict[str, float] = {}
        self.run_lengths_: Dict[str, np.ndarray] = {}  # empirical sojourns/regime

    # ------------------------------------------------------------------ fit
    def fit(self, panel: pd.DataFrame) -> "HSMMRegimeModel":
        from sklearn.preprocessing import StandardScaler

        mat_df, feats = select_hsmm_matrix(panel)
        self.feature_names = feats
        X = mat_df[feats].to_numpy(dtype=float)
        self.scaler = StandardScaler().fit(X)
        Xs = self.scaler.transform(X)

        lengths = (panel.groupby(PORT_ID, sort=False).size().to_numpy())

        GaussianHMM = _try_import_hmmlearn()
        states = None
        if GaussianHMM is not None:
            try:
                self.model = GaussianHMM(n_components=self.n_states,
                                         covariance_type="diag", n_iter=50,
                                         random_state=self.seed)
                self.model.fit(Xs, lengths)
                states = self.model.predict(Xs, lengths)
                self.backend = "hmm"
                log.info("HSMM backend: hmmlearn GaussianHMM.")
            except Exception as exc:  # pragma: no cover
                log.warning("hmmlearn failed (%s); using GaussianMixture.", exc)
                self.model = None

        if self.model is None:
            from sklearn.mixture import GaussianMixture
            self.model = GaussianMixture(n_components=self.n_states,
                                         covariance_type="full",
                                         random_state=self.seed, n_init=3)
            self.model.fit(Xs)
            states = self.model.predict(Xs)
            self.backend = "gmm"
            log.info("HSMM backend: scikit-learn GaussianMixture.")

        # --- map raw states -> regimes by ascending mean congestion ----------
        congestion = panel.get("congestion_index",
                               pd.Series(np.zeros(len(panel)))).to_numpy()
        order = sorted(range(self.n_states),
                       key=lambda s: np.nanmean(congestion[states == s])
                       if np.any(states == s) else np.inf)
        regime_names = [REGIME_NORMAL, REGIME_CONGESTED, REGIME_SEVERE][:self.n_states]
        self.state_to_regime = {state: regime_names[rank]
                                for rank, state in enumerate(order)}
        self.regime_to_state = {v: k for k, v in self.state_to_regime.items()}

        # --- empirical transition matrix + dwell durations over regimes ------
        regime_seq = np.array([REGIME_ORDER[self.state_to_regime[s]] for s in states])
        regime_seq = self._smooth_per_port(regime_seq, lengths)
        self.transmat_ = self._estimate_transmat(regime_seq, lengths)
        self.mean_duration_ = self._estimate_durations(regime_seq, lengths)
        return self

    # -------------------------------------------------------------- predict
    def predict(self, panel: pd.DataFrame) -> pd.DataFrame:
        if self.model is None:
            raise RuntimeError("Model not fitted. Call fit() first.")
        mat_df, feats = select_hsmm_matrix(panel)
        X = mat_df[feats].to_numpy(dtype=float)
        Xs = self.scaler.transform(X)
        lengths = panel.groupby(PORT_ID, sort=False).size().to_numpy()

        # soft posteriors per raw state
        if self.backend == "hmm":
            proba = self.model.predict_proba(Xs, lengths)
            raw_states = self.model.predict(Xs, lengths)
        else:
            proba = self.model.predict_proba(Xs)
            raw_states = self.model.predict(Xs)

        # reorder posterior columns into [NORMAL, CONGESTED, SEVERE]
        regime_proba = np.zeros((len(Xs), 3))
        for raw_state, regime in self.state_to_regime.items():
            regime_proba[:, REGIME_ORDER[regime]] += proba[:, raw_state]

        regime_idx = np.array([REGIME_ORDER[self.state_to_regime[s]]
                               for s in raw_states])
        regime_idx = self._smooth_per_port(regime_idx, lengths)

        out = mat_df[[PORT_ID, DATE]].copy()
        out["regime_label"] = [REGIME_LABELS[i] for i in regime_idx]
        out["p_normal"] = regime_proba[:, 0].round(4)
        out["p_congested"] = regime_proba[:, 1].round(4)
        out["p_severe"] = regime_proba[:, 2].round(4)
        out["regime_confidence"] = regime_proba.max(axis=1).round(4)

        # duration features computed per port (sequential)
        days_in_state = np.zeros(len(out), dtype=int)
        exp_remaining = np.zeros(len(out))
        trans_risk = np.zeros(len(out))
        start = 0
        for L in lengths:
            sl = slice(start, start + L)
            seq = regime_idx[sl]
            dis = _run_lengths_so_far(seq)
            days_in_state[sl] = dis
            for j in range(L):
                cur = seq[j]
                exp_remaining[start + j] = self._expected_remaining(cur, dis[j])
                trans_risk[start + j] = self._escalation_risk(cur)
            start += L

        out["days_in_state"] = days_in_state
        out["expected_remaining_days"] = np.round(exp_remaining, 2)
        out["transition_risk"] = np.round(trans_risk, 4)
        return out[_OUT_COLS]

    def fit_predict(self, panel: pd.DataFrame) -> pd.DataFrame:
        return self.fit(panel).predict(panel)

    # ----------------------------------------------------------- internals
    def _smooth_per_port(self, regime_idx: np.ndarray, lengths) -> np.ndarray:
        out = regime_idx.copy()
        start = 0
        for L in lengths:
            out[start:start + L] = _mode_smooth(regime_idx[start:start + L],
                                                self.smooth_window)
            start += L
        return out

    def _estimate_transmat(self, regime_seq: np.ndarray, lengths) -> np.ndarray:
        T = np.ones((3, 3))  # Laplace smoothing
        start = 0
        for L in lengths:
            seq = regime_seq[start:start + L]
            for a, b in zip(seq[:-1], seq[1:]):
                T[a, b] += 1
            start += L
        return T / T.sum(axis=1, keepdims=True)

    def _estimate_durations(self, regime_seq: np.ndarray, lengths
                            ) -> Dict[str, float]:
        runs = {0: [], 1: [], 2: []}
        start = 0
        for L in lengths:
            seq = regime_seq[start:start + L]
            if L == 0:
                continue
            cur, run = seq[0], 1
            for x in seq[1:]:
                if x == cur:
                    run += 1
                else:
                    runs[cur].append(run)
                    cur, run = x, 1
            runs[cur].append(run)
            start += L
        # keep the raw sojourn distribution per regime for residual-life estimates
        self.run_lengths_ = {REGIME_LABELS[i]: np.array(v if v else [2])
                             for i, v in runs.items()}
        return {REGIME_LABELS[i]: (float(np.mean(v)) if v else 2.0)
                for i, v in runs.items()}

    def _expected_remaining(self, regime_idx: int, days_in_state: int) -> float:
        """Semi-Markov residual sojourn: E[D - d | D > d] from the empirical
        run-length distribution of this regime. This is the proper HSMM
        "how much longer" quantity and stays positive and meaningful.
        """
        label = REGIME_LABELS[regime_idx]
        runs = self.run_lengths_.get(label)
        if runs is None or len(runs) == 0:
            p_self = self.transmat_[regime_idx, regime_idx] if self.transmat_ is not None else 0.7
            return float(1.0 / max(1e-6, 1.0 - min(p_self, 0.999)))
        longer = runs[runs > days_in_state]
        if len(longer) > 0:
            return float(np.mean(longer - days_in_state))
        return 1.0  # current spell already as long as any seen -> ending soon

    def _escalation_risk(self, regime_idx: int) -> float:
        """Probability of moving to a *more severe* regime next step."""
        if self.transmat_ is None:
            return 0.0
        if regime_idx >= 2:
            return 0.0  # already at most severe
        return float(self.transmat_[regime_idx, regime_idx + 1:].sum())


def run(panel: pd.DataFrame, seed: int = RANDOM_SEED) -> pd.DataFrame:
    """Convenience: fit + predict on the same panel (transductive prototype)."""
    return HSMMRegimeModel(seed=seed).fit_predict(panel)
