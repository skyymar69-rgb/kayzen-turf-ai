"""
Calibration des ajustements pace via minimisation de la NLL (negative log-likelihood)
sur données historiques — L-BFGS-B via scipy.optimize.

Usage :
  python -m pace.calibration --db-url postgresql://... --output pace/pace_adj_calibrated.npy
"""
from __future__ import annotations

import argparse
import logging

import numpy as np

try:
    from scipy.optimize import minimize
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False

from pace.monte_carlo import PACE_ADJUSTMENT, PL_TEMPERATURE

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Fonction de perte
# ─────────────────────────────────────────────────────────────────────────────

def _pl_nll(
    adj_flat: np.ndarray,
    pl_scores: np.ndarray,          # [n_races, n_runners]
    style_indices: np.ndarray,      # [n_races, n_runners] entiers 0-3
    scenario_indices: np.ndarray,   # [n_races] entiers 0-3
    winner_indices: np.ndarray,     # [n_races] index du vainqueur
) -> float:
    """
    NLL Plackett-Luce sur l'événement {horse[winner] gagne}.

    adj_matrix shape : [4_styles, 4_scenarios] → on reçoit 16 paramètres à plat.
    """
    adj_matrix = adj_flat.reshape(4, 4)
    n_races = pl_scores.shape[0]
    total_nll = 0.0

    for r in range(n_races):
        scores = pl_scores[r].copy()
        n_runners = (scores > -99).sum()
        scenario = scenario_indices[r]

        # Ajustement pace pour chaque cheval de cette course
        styles = style_indices[r, :n_runners]
        deltas = adj_matrix[styles, scenario]
        adjusted = scores[:n_runners] + deltas

        # Softmax PL
        s = adjusted / PL_TEMPERATURE
        s -= s.max()
        exps = np.exp(s)
        log_sum = np.log(exps.sum() + 1e-12)

        winner = winner_indices[r]
        total_nll += -(s[winner] - log_sum)

    return total_nll / max(n_races, 1)


def _nll_grad(
    adj_flat: np.ndarray,
    pl_scores: np.ndarray,
    style_indices: np.ndarray,
    scenario_indices: np.ndarray,
    winner_indices: np.ndarray,
) -> tuple[float, np.ndarray]:
    """NLL + gradient numérique (différences finies centrées, eps=1e-4)."""
    eps = 1e-4
    grad = np.zeros_like(adj_flat)
    f0 = _pl_nll(adj_flat, pl_scores, style_indices, scenario_indices, winner_indices)
    for i in range(len(adj_flat)):
        plus = adj_flat.copy()
        plus[i] += eps
        minus = adj_flat.copy()
        minus[i] -= eps
        grad[i] = (
            _pl_nll(plus, pl_scores, style_indices, scenario_indices, winner_indices)
            - _pl_nll(minus, pl_scores, style_indices, scenario_indices, winner_indices)
        ) / (2 * eps)
    return f0, grad


def calibrate_pace_adjustments(
    pl_scores: np.ndarray,
    style_indices: np.ndarray,
    scenario_indices: np.ndarray,
    winner_indices: np.ndarray,
    init_matrix: np.ndarray | None = None,
    max_iter: int = 200,
    bounds_abs: float = 8.0,
) -> np.ndarray:
    """
    Calibre la matrice PACE_ADJUSTMENT via L-BFGS-B.

    Paramètres
    ----------
    pl_scores       : [n_races, max_runners] scores PL bruts (padding −99 si absent)
    style_indices   : [n_races, max_runners] index style 0-3
    scenario_indices: [n_races] index scénario pace 0-3
    winner_indices  : [n_races] index du vainqueur dans la course
    init_matrix     : initialisation [4, 4], défaut = PACE_ADJUSTMENT courant
    bounds_abs      : bornes symétriques sur chaque paramètre (évite sur-ajustement)

    Retourne
    --------
    calibrated_matrix : np.ndarray [4, 4] — nouvelle matrice PACE_ADJUSTMENT
    """
    if not SCIPY_AVAILABLE:
        logger.warning("scipy non disponible — retourne la matrice par défaut")
        return PACE_ADJUSTMENT.copy()

    x0 = (init_matrix if init_matrix is not None else PACE_ADJUSTMENT).flatten()
    bounds = [(-bounds_abs, bounds_abs)] * len(x0)

    result = minimize(
        fun=lambda x: _nll_grad(x, pl_scores, style_indices, scenario_indices, winner_indices),
        x0=x0,
        method="L-BFGS-B",
        jac=True,
        bounds=bounds,
        options={"maxiter": max_iter, "ftol": 1e-8, "gtol": 1e-5},
    )

    if not result.success:
        logger.warning("L-BFGS-B n'a pas convergé : %s", result.message)

    calibrated = result.x.reshape(4, 4)
    logger.info("NLL initiale=%.4f → finale=%.4f", _pl_nll(x0, pl_scores, style_indices, scenario_indices, winner_indices), result.fun)
    return calibrated


def load_training_data_from_db(db_url: str) -> dict:
    """
    Charge les données d'entraînement depuis la DB.
    Retourne un dict avec clés : pl_scores, style_indices, scenario_indices, winner_indices.

    Requiert la table prediction_logs + odds_snapshots + une table race_positions.
    Stub — à implémenter selon le schéma DB en prod.
    """
    raise NotImplementedError(
        "load_training_data_from_db() à implémenter avec le schéma DB prod. "
        "Les tables requises : prediction_logs, odds_snapshots, race_pace_labels."
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Calibration pace PACE_ADJUSTMENT")
    parser.add_argument("--db-url", required=True)
    parser.add_argument("--output", default="pace/pace_adj_calibrated.npy")
    parser.add_argument("--max-iter", type=int, default=200)
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)
    data = load_training_data_from_db(args.db_url)

    calibrated = calibrate_pace_adjustments(
        pl_scores=data["pl_scores"],
        style_indices=data["style_indices"],
        scenario_indices=data["scenario_indices"],
        winner_indices=data["winner_indices"],
        max_iter=args.max_iter,
    )

    np.save(args.output, calibrated)
    print(f"Matrice calibrée sauvegardée → {args.output}")
    print(calibrated)
