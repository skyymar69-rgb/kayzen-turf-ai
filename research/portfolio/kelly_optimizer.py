"""
Optimisation de portefeuille journalier — Kelly multivarié via CVXPY.
Maximise E[log(1 + Σ fᵢ Rᵢ)] sous contraintes de budget, caps Kelly et solvabilité.
"""
from __future__ import annotations

import numpy as np

try:
    import cvxpy as cp
    CVXPY_AVAILABLE = True
except ImportError:
    CVXPY_AVAILABLE = False

from portfolio.scenarios import Bet


DRAWDOWN_MULTIPLIERS = [
    (0, 10, 1.00),
    (10, 15, 0.75),
    (15, 25, 0.50),
    (25, 35, 0.25),
    (35, 100, 0.10),
]


def drawdown_to_multiplier(dd_pct: float) -> float:
    for lo, hi, mult in DRAWDOWN_MULTIPLIERS:
        if lo <= dd_pct < hi:
            return mult
    return 0.10


def compute_kelly_caps(
    bets: list[Bet],
    fraction: float = 0.25,
    max_stake_frac: float = 0.05,
) -> np.ndarray:
    """Cap individuel = Kelly fractionnel classique par pari."""
    caps = []
    for bet in bets:
        net_odds = bet.odds - 1
        if net_odds <= 0 or bet.p_calibrated <= 0:
            caps.append(0.0)
            continue
        kelly_full = (bet.p_calibrated * bet.odds - 1) / net_odds
        cap = max(0.0, min(kelly_full * fraction, max_stake_frac))
        caps.append(cap)
    return np.array(caps, dtype=np.float64)


def optimize_portfolio(
    R: np.ndarray,
    kelly_caps: np.ndarray,
    daily_budget_frac: float = 0.20,
    drawdown_multiplier: float = 1.0,
    safety_floor: float = 0.80,   # 1 + portfolio_return ≥ 0.80 → perte max 20%/jour
) -> dict:
    """
    Résout : max E[log(1 + Σ fᵢ Rᵢ)]
    s.t.    Σ fᵢ ≤ daily_budget_frac × drawdown_multiplier
            0 ≤ fᵢ ≤ kelly_caps[i] × drawdown_multiplier
            1 + Σ fᵢ Rᵢ ≥ safety_floor  ∀ scénario s

    Fallback proportionnel si CVXPY absent.
    """
    n_scenarios, n_bets = R.shape
    adjusted_cap = kelly_caps * drawdown_multiplier
    budget = daily_budget_frac * drawdown_multiplier

    if not CVXPY_AVAILABLE:
        return _fallback_proportional(R, adjusted_cap, budget, safety_floor, n_bets)

    f = cp.Variable(n_bets, nonneg=True)
    portfolio_returns = R @ f   # [n_scenarios]

    objective = cp.Maximize(
        cp.sum(cp.log(1.0 + portfolio_returns)) / n_scenarios
    )

    constraints = [
        cp.sum(f) <= budget,
        f <= adjusted_cap,
        1.0 + portfolio_returns >= safety_floor,
    ]

    prob = cp.Problem(objective, constraints)
    prob.solve(solver=cp.SCS, verbose=False, eps=1e-4)

    if prob.status not in {"optimal", "optimal_inaccurate"} or f.value is None:
        return {
            "fractions": np.zeros(n_bets),
            "expected_log_growth": 0.0,
            "total_exposure": 0.0,
            "worst_case_return": 0.0,
            "n_active_bets": 0,
            "status": prob.status or "infeasible",
        }

    fractions = np.clip(np.array(f.value).flatten(), 0, None)
    fractions[fractions < 1e-4] = 0.0

    portfolio_val = R @ fractions
    return {
        "fractions": fractions,
        "expected_log_growth": float(prob.value),
        "total_exposure": float(fractions.sum()),
        "worst_case_return": float(portfolio_val.min()),
        "n_active_bets": int((fractions > 1e-4).sum()),
        "status": prob.status,
    }


def _fallback_proportional(R, caps, budget, safety_floor, n_bets) -> dict:
    """
    Fallback si CVXPY absent : Kelly individuel plafonné par budget total.
    """
    fractions = np.clip(caps, 0, None)
    total = fractions.sum()
    if total > budget:
        fractions = fractions * (budget / total)
    fractions[fractions < 1e-4] = 0.0
    portfolio_val = R @ fractions
    return {
        "fractions": fractions,
        "expected_log_growth": float(np.mean(np.log(np.clip(1 + portfolio_val, 1e-6, None)))),
        "total_exposure": float(fractions.sum()),
        "worst_case_return": float(portfolio_val.min()),
        "n_active_bets": int((fractions > 1e-4).sum()),
        "status": "fallback_proportional",
    }


def format_portfolio_output(
    bets: list[Bet],
    result: dict,
    bankroll: float,
) -> dict:
    """Convertit les fractions en mises EUR et formate la sortie."""
    fractions = result["fractions"]
    stakes = fractions * bankroll

    active = [
        {
            "bet_id": bets[i].bet_id,
            "race_id": bets[i].race_id,
            "bet_type": bets[i].bet_type,
            "selection": list(bets[i].selection),
            "odds": bets[i].odds,
            "p_calibrated": bets[i].p_calibrated,
            "stake_eur": round(float(stakes[i]), 2),
            "fraction_pct": round(float(fractions[i]) * 100, 2),
            "kelly_cap_pct": round(float(0) * 100, 2),  # filled below
        }
        for i in range(len(bets))
        if fractions[i] > 1e-4
    ]

    return {
        "bets": active,
        "summary": {
            "n_bets": result["n_active_bets"],
            "total_stake_eur": round(float(stakes[fractions > 1e-4].sum()), 2),
            "total_exposure_pct": round(result["total_exposure"] * 100, 2),
            "expected_log_growth_pct": round(result["expected_log_growth"] * 100, 4),
            "worst_case_return_pct": round(result["worst_case_return"] * 100, 2),
            "optimizer_status": result["status"],
        },
    }
