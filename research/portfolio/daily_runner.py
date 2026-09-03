"""
Pipeline journalier complet — du programme PMU au portefeuille optimisé.
Orchestre : Module A (drift filter) + PL scenarios + CVXPY Kelly portfolio.

Usage :
  python portfolio/daily_runner.py --date 2026-05-08 --bankroll 1000 --drawdown 12
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
from datetime import date

from portfolio.kelly_optimizer import (
    compute_kelly_caps,
    drawdown_to_multiplier,
    format_portfolio_output,
    optimize_portfolio,
)
from portfolio.scenarios import Bet, compute_bet_returns, sample_pl_scenarios


async def build_daily_portfolio(
    date_str: str,
    bankroll: float,
    drawdown_pct: float,
    daily_budget_frac: float = 0.20,
    n_scenarios: int = 2000,
    min_edge: float = 0.05,
    min_clv: float = 0.02,
) -> dict:
    """
    Construit le portefeuille optimisé pour une journée.

    Pipeline :
      1. Charge le programme PMU du jour
      2. Pour chaque course : génère scénarios PL
      3. Pour chaque candidat pari : applique le filtre Module A (drift + edge + CLV)
      4. Calcule la matrice R de rendements
      5. Optimise via CVXPY Kelly multivarié
      6. Retourne les mises EUR + résumé

    En prod, remplacer les stubs _load_races / _predict_pl_scores / _get_drift_signals
    par les vraies implémentations qui interrogent la DB et les agents FastAPI.
    """
    races = await _load_races(date_str)

    if not races:
        return {"bets": [], "summary": {"reason": "no_races_found"}}

    all_bets: list[Bet] = []
    scenarios_per_race: dict[str, any] = {}
    horse_indices: dict[str, dict[str, int]] = {}

    for race in races:
        pl_scores = await _predict_pl_scores(race)

        if len(pl_scores) < 2:
            continue

        import numpy as np
        scores_array = np.array(list(pl_scores.values()), dtype=np.float64)
        horse_ids = list(pl_scores.keys())
        horse_indices[race["id"]] = {hid: i for i, hid in enumerate(horse_ids)}
        scenarios_per_race[race["id"]] = sample_pl_scenarios(scores_array, n_scenarios=n_scenarios)

        drift_all = await _get_drift_signals(race)

        for horse in race["horses"]:
            hid = horse["id"]
            if hid not in pl_scores:
                continue

            p = _pl_to_p_win(pl_scores, hid)
            drift = drift_all.get(hid, {})
            predicted_close = horse.get("predicted_odds_close", horse["odds"])

            from decision.value_filter import decide_bet, effective_odds_after_takeout
            decision = decide_bet(
                horse_id=hid,
                p_calibrated=p,
                odds_now=horse["odds"],
                predicted_odds_close=predicted_close,
                drift_signals=drift,
                bet_type="simple_gagnant",
                min_edge=min_edge,
                min_clv=min_clv,
            )

            if decision.bet:
                net_odds = effective_odds_after_takeout(predicted_close, "simple_gagnant")
                all_bets.append(Bet(
                    bet_id=f"{race['id']}-{hid}-sg",
                    race_id=race["id"],
                    bet_type="simple_gagnant",
                    selection=(hid,),
                    odds=net_odds,
                    p_calibrated=p,
                ))

    if not all_bets:
        return {"bets": [], "summary": {"reason": "no_candidates_passed_filter", "n_candidates": 0}}

    import numpy as np
    R = compute_bet_returns(all_bets, scenarios_per_race, horse_indices)
    kelly_caps = compute_kelly_caps(all_bets)
    dd_mult = drawdown_to_multiplier(drawdown_pct)

    result = optimize_portfolio(
        R, kelly_caps,
        daily_budget_frac=daily_budget_frac,
        drawdown_multiplier=dd_mult,
    )

    output = format_portfolio_output(all_bets, result, bankroll)
    output["date"] = date_str
    output["bankroll_eur"] = bankroll
    output["drawdown_pct"] = drawdown_pct
    output["n_candidates_before_filter"] = len(all_bets)

    return output


# ─────────────────────────────────────────────────────────────
# STUBS — à remplacer par implémentations DB + agents en Phase 2
# ─────────────────────────────────────────────────────────────

async def _load_races(date_str: str) -> list[dict]:
    """Charge le programme depuis la DB ou l'API PMU."""
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        return []  # pas de DB configurée
    try:
        import psycopg
        async with await psycopg.AsyncConnection.connect(db_url) as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "SELECT id, discipline, distance, going FROM races WHERE race_date = %s",
                    (date_str,),
                )
                rows = await cur.fetchall()
        return [{"id": r[0], "discipline": r[1], "horses": []} for r in rows]
    except Exception:
        return []


async def _predict_pl_scores(race: dict) -> dict[str, float]:
    """Scores PL depuis l'agent form_agent."""
    return {}   # stub — appeler form_agent /score en prod


async def _get_drift_signals(race: dict) -> dict[str, dict]:
    """Signaux drift depuis market_agent ou snapshots DB."""
    return {}   # stub — calculer depuis odds_snapshots en prod


def _pl_to_p_win(pl_scores: dict[str, float], horse_id: str) -> float:
    import numpy as np
    scores = np.array(list(pl_scores.values()))
    horse_idx = list(pl_scores.keys()).index(horse_id)
    e = np.exp(scores - scores.max())
    p = e / e.sum()
    return float(p[horse_idx])


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", default=date.today().isoformat())
    parser.add_argument("--bankroll", type=float, default=1000.0)
    parser.add_argument("--drawdown", type=float, default=0.0)
    parser.add_argument("--budget-frac", type=float, default=0.20)
    parser.add_argument("--min-edge", type=float, default=0.05)
    parser.add_argument("--min-clv", type=float, default=0.02)
    args = parser.parse_args()

    result = asyncio.run(build_daily_portfolio(
        args.date, args.bankroll, args.drawdown,
        daily_budget_frac=args.budget_frac,
        min_edge=args.min_edge,
        min_clv=args.min_clv,
    ))
    print(json.dumps(result, indent=2, default=str))
