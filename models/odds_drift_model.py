"""
Modèle LightGBM de prédiction de cote de fermeture PMU.
Objectif : prédire log(odds_close) depuis les features à decision_time.
"""
from __future__ import annotations

import hashlib
import os
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error

from features.drift_features import DRIFT_FEATURES


def train_drift_model(
    features_df: pd.DataFrame,
    val_dates: pd.Index | list,
) -> lgb.Booster:
    """
    features_df colonnes : DRIFT_FEATURES + race_date + log_odds_close (target)
    val_dates : dates de validation — split temporel strict.
    """
    features_df = features_df.copy()
    features_df["race_date"] = pd.to_datetime(features_df["race_date"])

    val_date_set = set(pd.to_datetime(val_dates))
    train_mask = ~features_df["race_date"].isin(val_date_set)
    val_mask = features_df["race_date"].isin(val_date_set)

    X_tr = features_df.loc[train_mask, DRIFT_FEATURES].fillna(0).values
    y_tr = features_df.loc[train_mask, "log_odds_close"].values
    X_va = features_df.loc[val_mask, DRIFT_FEATURES].fillna(0).values
    y_va = features_df.loc[val_mask, "log_odds_close"].values

    model = lgb.train(
        params={
            "objective": "regression",
            "metric": "mae",
            "learning_rate": 0.05,
            "num_leaves": 31,
            "min_data_in_leaf": 50,
            "feature_fraction": 0.85,
            "bagging_fraction": 0.85,
            "bagging_freq": 5,
            "verbose": -1,
        },
        train_set=lgb.Dataset(X_tr, y_tr, feature_name=DRIFT_FEATURES),
        num_boost_round=2000,
        valid_sets=[lgb.Dataset(X_va, y_va, feature_name=DRIFT_FEATURES)],
        callbacks=[lgb.early_stopping(100, verbose=False)],
    )

    pred_log = model.predict(X_va)
    pred_odds = np.exp(pred_log)
    actual_odds = np.exp(y_va)
    mae_log = mean_absolute_error(y_va, pred_log)
    mae_rel = float((np.abs(pred_odds - actual_odds) / actual_odds).mean())
    print(f"Drift model — MAE log_odds: {mae_log:.4f}  MAE relative: {mae_rel:.4f}")

    return model


def predict_close(model: lgb.Booster, features_df: pd.DataFrame) -> pd.DataFrame:
    """
    Prédit odds_close avec intervalle de confiance approché (80% CI via volatilité cheval).
    """
    X = features_df[DRIFT_FEATURES].fillna(0).values
    log_pred = model.predict(X)
    sigma = features_df["volatility"].fillna(0.15).clip(lower=0.05).values

    return pd.DataFrame({
        "horse_id": features_df["horse_id"].values,
        "predicted_odds_close": np.exp(log_pred),
        "predicted_odds_lower": np.exp(log_pred - 1.28 * sigma),   # ~80% CI
        "predicted_odds_upper": np.exp(log_pred + 1.28 * sigma),
        "current_odds": np.exp(features_df["log_odds_now"].values),
        "predicted_drift_pct": (np.exp(log_pred) / np.exp(features_df["log_odds_now"].values) - 1) * 100,
    })


def save_model(model: lgb.Booster, path: str) -> str:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    model.save_model(path)
    sha = hashlib.sha256(open(path, "rb").read()).hexdigest()[:12]
    print(f"Drift model saved → {path}  sha={sha}")
    return sha


def load_model(path: str) -> lgb.Booster:
    return lgb.Booster(model_file=path)
