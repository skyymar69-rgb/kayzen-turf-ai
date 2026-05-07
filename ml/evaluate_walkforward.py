"""
Walk-forward evaluation avec CLV comme métrique primaire.
Interdit le split aléatoire (leakage temporel).
"""
from __future__ import annotations

import warnings
from typing import Callable

import numpy as np
import pandas as pd

from data_loader import load_races, make_engine, to_ranking_format
from train_lgbm import monte_carlo_top_k_probs, predict_race, softmax_safe, train_pl_lambdarank


def walk_forward_eval(
    df: pd.DataFrame,
    model_factory: Callable,
    train_months: int = 12,
    val_months: int = 1,
    step_months: int = 1,
) -> pd.DataFrame:
    """
    Boucle walk-forward : train sur [t - train_months, t], val sur [t, t + val_months].
    Retourne un DataFrame : une ligne par fold avec log_loss, brier, top1_acc, top3_hit, clv.
    """
    df = df.copy()
    df["race_date"] = pd.to_datetime(df["race_date"])

    start = df["race_date"].min() + pd.DateOffset(months=train_months)
    end = df["race_date"].max() - pd.DateOffset(months=val_months)

    rows = []
    cursor = start

    while cursor < end:
        train_mask = (
            (df["race_date"] >= cursor - pd.DateOffset(months=train_months))
            & (df["race_date"] < cursor)
        )
        val_mask = (
            (df["race_date"] >= cursor)
            & (df["race_date"] < cursor + pd.DateOffset(months=val_months))
        )

        df_tr, df_va = df[train_mask], df[val_mask]
        if len(df_tr) < 1000 or len(df_va) < 100:
            cursor += pd.DateOffset(months=step_months)
            continue

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            model = model_factory(df_tr, df_va)

        metrics = score_fold(model, df_va)
        metrics["fold_start"] = cursor
        metrics["n_train_races"] = df_tr["race_id"].nunique()
        metrics["n_val_races"] = df_va["race_id"].nunique()
        rows.append(metrics)
        print(f"  fold {cursor.date()} — {metrics}")

        cursor += pd.DateOffset(months=step_months)

    return pd.DataFrame(rows)


def score_fold(model, df_val: pd.DataFrame) -> dict:
    """
    Calcule par course :
      - log_loss du vainqueur (under PL)
      - Brier multiclasse approché
      - top1 / top3 hit
      - CLV moyen sur paris simulés à edge > 5%
    """
    log_losses, briers, top1_hits, top3_hits, clvs = [], [], [], [], []

    for race_id, race_df in df_val.groupby("race_id"):
        race_df = race_df.reset_index(drop=True)
        finish = race_df["finish_position"].values
        valid = np.isfinite(finish.astype(float))

        if valid.sum() < 2:
            continue

        try:
            scores = predict_race(model, race_df)
        except Exception:
            continue

        p_win = softmax_safe(scores)
        p_top3 = monte_carlo_top_k_probs(scores, k=3, n_sim=2000, seed=0)

        winner_idx = int(np.where(valid & (finish == finish[valid].min()))[0][0])

        log_losses.append(-np.log(np.clip(p_win[winner_idx], 1e-6, 1.0)))

        y_onehot = np.zeros(len(race_df))
        y_onehot[winner_idx] = 1
        briers.append(float(((p_win - y_onehot) ** 2).sum()))

        top1_hits.append(int(p_win.argmax() == winner_idx))
        pred_top3 = set(np.argsort(-p_top3)[:3])
        actual_top3 = set(np.where(valid & (finish <= 3))[0])
        top3_hits.append(len(pred_top3 & actual_top3) / 3)

        # CLV : cotes J-1 vs cotes fermeture
        if "odds_open" in race_df.columns and "odds_close" in race_df.columns:
            odds_open = race_df["odds_open"].values
            odds_close = race_df["odds_close"].values
            edges = p_win * odds_open - 1
            bet_mask = edges > 0.05
            if bet_mask.any():
                with np.errstate(divide="ignore", invalid="ignore"):
                    clv = np.where(odds_close > 0, odds_open / odds_close - 1, np.nan)
                clvs.extend(clv[bet_mask & np.isfinite(clv)].tolist())

    return {
        "log_loss": float(np.mean(log_losses)) if log_losses else np.nan,
        "brier": float(np.mean(briers)) if briers else np.nan,
        "top1_acc": float(np.mean(top1_hits)) if top1_hits else np.nan,
        "top3_hit": float(np.mean(top3_hits)) if top3_hits else np.nan,
        "clv_mean": float(np.mean(clvs)) if clvs else np.nan,
        "n_bets": len(clvs),
    }


def bootstrap_diff_test(
    values_a: np.ndarray,
    values_b: np.ndarray,
    n_iters: int = 1000,
    seed: int = 42,
) -> float:
    """
    Test bootstrap unilatéral : P(mean_b < mean_a).
    Retourne p-value. Promotion si p < 0.05 (challenger b est meilleur).
    """
    rng = np.random.default_rng(seed)
    n = min(len(values_a), len(values_b))
    if n < 10:
        return 1.0

    count = 0
    for _ in range(n_iters):
        idx = rng.integers(0, n, size=n)
        if values_b[idx].mean() < values_a[idx].mean():
            count += 1
    return count / n_iters


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-url", required=True)
    parser.add_argument("--date-start", default="2023-01-01")
    parser.add_argument("--date-end", default="2026-03-31")
    parser.add_argument("--train-months", type=int, default=12)
    parser.add_argument("--val-months", type=int, default=1)
    args = parser.parse_args()

    engine = make_engine(args.db_url)
    df = load_races(engine, args.date_start, args.date_end)
    print(f"Loaded {len(df)} runners / {df['race_id'].nunique()} races")

    results = walk_forward_eval(
        df,
        model_factory=train_pl_lambdarank,
        train_months=args.train_months,
        val_months=args.val_months,
    )
    print("\nWalk-forward results:")
    print(results.to_string(index=False))
    print(f"\nMean CLV: {results['clv_mean'].mean():.2%}")
    print(f"Mean top1: {results['top1_acc'].mean():.2%}")
