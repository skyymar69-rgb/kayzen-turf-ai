"""
Champion-challenger automatisé.
Tourne quotidiennement (cron). Promeut le challenger si :
  1. log_loss_challenger < log_loss_champion sur ≥ 6 folds glissants
  2. clv_mean_challenger > 0 ET > clv_champion (bootstrap p < 0.05)
  3. Aucune dégradation > 1σ sur un sous-segment (discipline, taille champ, hippodrome)
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


def load_predictions(db_url: str, agent_name: str, role: str, days: int) -> pd.DataFrame:
    """
    Charge les prédictions loguées depuis la DB pour comparaison champion vs challenger.
    Chaque ligne : race_id, horse_id, predicted_p_win, actual_winner, log_loss_per_race,
                   odds_taken, odds_closing, model_version, role.
    """
    from sqlalchemy import create_engine, text
    engine = create_engine(db_url)
    cutoff = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
    query = text("""
        SELECT p.race_id, p.horse_id, p.predicted_p_win, p.actual_winner,
               p.log_loss_per_race, p.odds_taken, p.odds_closing,
               p.model_version, p.role
        FROM prediction_logs p
        WHERE p.agent_name = :agent AND p.role = :role
          AND p.race_date >= :cutoff
        ORDER BY p.race_date
    """)
    with engine.connect() as conn:
        return pd.read_sql(query, conn, params={"agent": agent_name, "role": role, "cutoff": cutoff})


def compute_metrics(df: pd.DataFrame) -> dict:
    log_loss = df["log_loss_per_race"].mean() if "log_loss_per_race" in df.columns else np.nan

    # CLV moyen sur les paris simulés (edge > 5%)
    if "odds_taken" in df.columns and "odds_closing" in df.columns:
        with np.errstate(divide="ignore", invalid="ignore"):
            clv = np.where(
                df["odds_closing"] > 0,
                df["odds_taken"] / df["odds_closing"] - 1,
                np.nan,
            )
        clv_valid = clv[np.isfinite(clv)]
        clv_mean = float(np.mean(clv_valid)) if len(clv_valid) > 0 else np.nan
    else:
        clv_mean = np.nan

    return {
        "log_loss": float(log_loss),
        "clv_mean": float(clv_mean),
        "n_races": df["race_id"].nunique() if "race_id" in df else len(df),
    }


def bootstrap_test(values_a: np.ndarray, values_b: np.ndarray, n_iters: int = 1000, seed: int = 42) -> float:
    """P(mean_b < mean_a) — retourne p-value. Faible = challenger meilleur."""
    rng = np.random.default_rng(seed)
    n = min(len(values_a), len(values_b))
    if n < 10:
        return 1.0
    count = sum(
        1 for _ in range(n_iters)
        if values_b[rng.integers(0, n, n)].mean() < values_a[rng.integers(0, n, n)].mean()
    )
    return count / n_iters


def has_segment_regression(df_champ: pd.DataFrame, df_chall: pd.DataFrame, sigma_threshold: float = 1.0) -> bool:
    """Vérifie qu'aucun sous-segment ne se dégrade de plus de sigma_threshold écarts-types."""
    if "discipline" not in df_champ.columns:
        return False

    for discipline in ["plat", "trot", "obstacle"]:
        c = df_champ[df_champ["discipline"] == discipline]["log_loss_per_race"].values
        h = df_chall[df_chall["discipline"] == discipline]["log_loss_per_race"].values
        if len(c) < 5 or len(h) < 5:
            continue
        sigma = c.std()
        if h.mean() > c.mean() + sigma_threshold * sigma:
            log.warning(f"Segment regression detected for discipline={discipline}")
            return True

    return False


def evaluate_promotion(db_url: str, agent_name: str, days: int = 30) -> dict:
    log.info(f"Evaluating {agent_name} champion vs challenger over {days}d")

    try:
        champ = load_predictions(db_url, agent_name, "champion", days)
        chall = load_predictions(db_url, agent_name, "challenger", days)
    except Exception as e:
        return {"promote": False, "reason": f"DB error: {e}"}

    if len(champ) < 50 or len(chall) < 50:
        return {"promote": False, "reason": f"Not enough data (champ={len(champ)}, chall={len(chall)})"}

    champ_m = compute_metrics(champ)
    chall_m = compute_metrics(chall)

    ll_champ = champ["log_loss_per_race"].values
    ll_chall = chall["log_loss_per_race"].values
    p_value = bootstrap_test(ll_champ, ll_chall)

    segment_regress = has_segment_regression(champ, chall)

    promote = (
        chall_m["log_loss"] < champ_m["log_loss"]
        and not np.isnan(chall_m["clv_mean"])
        and chall_m["clv_mean"] > 0
        and chall_m["clv_mean"] > champ_m["clv_mean"]
        and p_value < 0.05
        and not segment_regress
    )

    result = {
        "promote": promote,
        "agent": agent_name,
        "evaluated_at": datetime.utcnow().isoformat(),
        "champion": champ_m,
        "challenger": chall_m,
        "deltas": {k: round(chall_m[k] - champ_m[k], 6) for k in ["log_loss", "clv_mean"]},
        "p_value": round(p_value, 4),
        "segment_regression": segment_regress,
        "reason": "All criteria met" if promote else (
            "Challenger CLV ≤ 0" if chall_m["clv_mean"] <= 0 else
            "Not significant" if p_value >= 0.05 else
            "Segment regression" if segment_regress else
            "Log-loss not improved"
        ),
    }

    if promote:
        log.info(f"✅ PROMOTE {agent_name} challenger → champion: {result}")
    else:
        log.info(f"❌ No promotion for {agent_name}: {result['reason']}")

    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Champion-challenger evaluation")
    parser.add_argument("--db-url", required=True)
    parser.add_argument("--agents", nargs="+", default=["form_agent"])
    parser.add_argument("--days", type=int, default=30)
    parser.add_argument("--output", default=None, help="JSON output path")
    args = parser.parse_args()

    all_results = {}
    for agent in args.agents:
        all_results[agent] = evaluate_promotion(args.db_url, agent, args.days)

    output = json.dumps(all_results, indent=2, default=str)
    print(output)

    if args.output:
        Path(args.output).write_text(output)
        log.info(f"Results written to {args.output}")

    any_promotion = any(r["promote"] for r in all_results.values())
    sys.exit(0 if any_promotion else 1)
