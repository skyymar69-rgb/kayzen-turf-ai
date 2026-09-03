"""
Meta-learner stacking : combine les scores des 5 agents via LightGBM lambdarank.
Calibration isotone sur p_win pour garantir des probabilités bien calibrées.
"""
from __future__ import annotations

import pickle
from pathlib import Path
from typing import Optional

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.isotonic import IsotonicRegression

from contracts import RaceContext


class PLMetaLearner:
    """
    Combiner les sorties des agents en un score PL final.
    Phase 1 : GBT lambdarank méta-niveau sur les scores agents.
    Phase 2 : calibration isotone sur p_win (mapping monotone exact).
    """

    def __init__(self):
        self.stacker: Optional[lgb.Booster] = None
        self.calibrator: Optional[IsotonicRegression] = None
        self.agent_names: list[str] = []

    def fit(
        self,
        stack_train: np.ndarray,          # [n_horses, n_agents]
        confidence_train: np.ndarray,      # [n_horses, n_agents]
        ranks_train: pd.Series,            # finish position par cheval
        race_ids_train: pd.Series,         # race_id par cheval
        agent_names: list[str],
    ):
        self.agent_names = agent_names

        # Pondérer par confidence avant d'alimenter le meta-stacker
        X = stack_train * confidence_train
        # Remplace NaN par 0 (agent down)
        X = np.nan_to_num(X, nan=0.0)

        # Relevance top-5 pour lambdarank
        K = 5
        pos = ranks_train.fillna(99).astype(int).values
        y = np.where(pos == 1, K, np.where(pos == 2, K-1, np.where(pos == 3, K-2,
            np.where(pos == 4, K-3, np.where(pos == 5, K-4, 0)))))

        groups = race_ids_train.value_counts(sort=False).sort_index().values

        ds = lgb.Dataset(X, label=y.astype(np.int32), group=groups,
                         feature_name=agent_names)
        params = {
            "objective": "lambdarank",
            "metric": "ndcg",
            "ndcg_eval_at": [1, 3],
            "num_leaves": 15,
            "learning_rate": 0.05,
            "feature_fraction": 1.0,
            "verbose": -1,
        }
        self.stacker = lgb.train(params, ds, num_boost_round=300)

        # Calibration isotone : map raw meta-score → p_win réelle
        meta_scores = self.stacker.predict(X, raw_score=True)
        p_wins, is_winners = [], []

        for race_id, idxs in pd.DataFrame({"race_id": race_ids_train}).groupby("race_id").groups.items():
            idxs = list(idxs)
            s = meta_scores[idxs]
            e = np.exp(s - s.max())
            p = e / e.sum()
            winner_local = ranks_train.iloc[idxs].values.argmin()
            for k, pi in enumerate(p):
                p_wins.append(float(pi))
                is_winners.append(int(k == winner_local))

        self.calibrator = IsotonicRegression(out_of_bounds="clip", increasing=True)
        self.calibrator.fit(p_wins, is_winners)

    def combine(self, stack: np.ndarray, confidence: np.ndarray, ctx: RaceContext) -> np.ndarray:
        """
        Retourne des scores PL raw pour chaque cheval.
        L'orchestrateur applique softmax + Monte Carlo en aval.
        """
        if self.stacker is None:
            # Fallback : moyenne pondérée simple
            w = np.nan_to_num(stack * confidence, nan=0.0)
            conf_sum = confidence.sum(axis=1, keepdims=True).clip(min=1e-6)
            return (w.sum(axis=1) / conf_sum.squeeze())

        X = np.nan_to_num(stack * confidence, nan=0.0)
        return self.stacker.predict(X, raw_score=True)

    def calibrate_p_win(self, p_win_raw: float) -> float:
        if self.calibrator is None:
            return p_win_raw
        return float(self.calibrator.predict([p_win_raw])[0])

    def save(self, path: str):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump({"stacker_path": path + ".stacker.lgb",
                         "calibrator": self.calibrator,
                         "agent_names": self.agent_names}, f)
        if self.stacker:
            self.stacker.save_model(path + ".stacker.lgb")

    @classmethod
    def load(cls, path: str) -> "PLMetaLearner":
        with open(path, "rb") as f:
            state = pickle.load(f)
        obj = cls()
        obj.calibrator = state["calibrator"]
        obj.agent_names = state["agent_names"]
        stacker_path = state["stacker_path"]
        if Path(stacker_path).exists():
            obj.stacker = lgb.Booster(model_file=stacker_path)
        return obj
