"""
Entraînement LightGBM Plackett-Luce (lambdarank) — Phase 2 baseline.
Produit un modèle sérialisé utilisable par form_agent.
"""
from __future__ import annotations

import argparse
import hashlib
import os
from pathlib import Path

import lightgbm as lgb
import numpy as np

from data_loader import ALL_FEATURES, load_races, make_engine, to_ranking_format


def train_pl_lambdarank(df_train, df_val):
    X_tr, y_tr, g_tr, _ = to_ranking_format(df_train)
    X_va, y_va, g_va, _ = to_ranking_format(df_val)

    train_set = lgb.Dataset(X_tr, label=y_tr, group=g_tr, feature_name=ALL_FEATURES)
    val_set = lgb.Dataset(X_va, label=y_va, group=g_va, reference=train_set)

    params = {
        "objective": "lambdarank",
        "metric": ["ndcg", "map"],
        "ndcg_eval_at": [1, 3, 5],
        "learning_rate": 0.03,
        "num_leaves": 63,
        "min_data_in_leaf": 100,
        "feature_fraction": 0.85,
        "bagging_fraction": 0.85,
        "bagging_freq": 5,
        "lambdarank_truncation_level": 5,
        "verbose": -1,
    }

    model = lgb.train(
        params,
        train_set,
        num_boost_round=3000,
        valid_sets=[val_set],
        callbacks=[lgb.early_stopping(stopping_rounds=100, verbose=True)],
    )
    return model


def softmax_safe(scores: np.ndarray) -> np.ndarray:
    """p_win cohérente avec PL — numériquement stable."""
    s = scores - scores.max()
    e = np.exp(s)
    return e / e.sum()


def monte_carlo_top_k_probs(scores: np.ndarray, k: int = 3, n_sim: int = 10_000, seed: int = 42) -> np.ndarray:
    """
    Estime p_topk via Gumbel-max trick : argmax(score_i + Gumbel_i) ~ PL.
    Garantit p_top5 ≥ p_top3 ≥ p_win par construction.
    """
    rng = np.random.default_rng(seed)
    n = len(scores)
    counts = np.zeros(n)

    for _ in range(n_sim):
        gumbel = rng.gumbel(size=n)
        order = np.argsort(-(scores + gumbel))
        counts[order[:k]] += 1

    return counts / n_sim


def predict_race(model: lgb.Booster, race_df, feature_names=None) -> np.ndarray:
    feats = feature_names or ALL_FEATURES
    X = race_df[feats].fillna(0).values.astype(np.float32)
    return model.predict(X, raw_score=True)


def save_model(model: lgb.Booster, output_dir: str, name: str) -> str:
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    path = os.path.join(output_dir, f"{name}.lgb")
    model.save_model(path)
    sha = hashlib.sha256(open(path, "rb").read()).hexdigest()[:12]
    print(f"Saved model → {path}  (sha={sha})")
    return path


def print_feature_importance(model: lgb.Booster, top_n: int = 20):
    imp = sorted(
        zip(model.feature_name(), model.feature_importance("gain")),
        key=lambda x: -x[1],
    )
    print(f"\nTop-{top_n} features by gain:")
    for feat, gain in imp[:top_n]:
        print(f"  {feat:<35} {gain:.1f}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-url", required=True, help="PostgreSQL DSN")
    parser.add_argument("--train-start", default="2023-01-01")
    parser.add_argument("--train-end", default="2025-12-31")
    parser.add_argument("--val-start", default="2026-01-01")
    parser.add_argument("--val-end", default="2026-03-31")
    parser.add_argument("--output-dir", default="models/form")
    parser.add_argument("--name", default="lgbm-pl-v1.0")
    args = parser.parse_args()

    engine = make_engine(args.db_url)
    print("Loading training data...")
    df_train = load_races(engine, args.train_start, args.train_end)
    df_val = load_races(engine, args.val_start, args.val_end)
    print(f"  Train: {len(df_train)} runners / {df_train['race_id'].nunique()} races")
    print(f"  Val:   {len(df_val)} runners / {df_val['race_id'].nunique()} races")

    print("Training PL lambdarank model...")
    model = train_pl_lambdarank(df_train, df_val)
    print_feature_importance(model)
    save_model(model, args.output_dir, args.name)


if __name__ == "__main__":
    main()
