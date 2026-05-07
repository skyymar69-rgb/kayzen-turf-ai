"""
Génération de scénarios Plackett-Luce et calcul de la matrice de rendements.
Alimentation de l'optimiseur CVXPY pour le portefeuille journalier.
"""
from __future__ import annotations

from typing import NamedTuple

import numpy as np


class Bet(NamedTuple):
    bet_id: str
    race_id: str
    bet_type: str          # simple_gagnant, simple_place, couple_gagnant, trio, ...
    selection: tuple       # (horse_id,) ou (h_a, h_b) ou (h1, h2, h3)
    odds: float            # cote fermeture × (1 − takeout) — paiement net
    p_calibrated: float    # proba calibrée PL


def sample_pl_scenarios(
    scores: np.ndarray,
    n_scenarios: int = 2000,
    seed: int = 42,
) -> np.ndarray:
    """
    Génère n_scenarios classements depuis Plackett-Luce via Gumbel-max trick.

    scores : [n_runners] raw PL scores
    Retourne : [n_scenarios, n_runners] positions (1-indexed, 1 = vainqueur)
    """
    rng = np.random.default_rng(seed)
    n_runners = len(scores)
    gumbel = rng.gumbel(size=(n_scenarios, n_runners))
    perturbed = scores[None, :] + gumbel                   # [n_sims, n_runners]
    order = np.argsort(-perturbed, axis=1)                  # [n_sims, n_runners] indices triés

    # Convertir en positions
    positions = np.empty_like(order)
    rows = np.arange(n_scenarios)[:, None]
    cols = np.arange(n_runners)[None, :]
    positions[rows, order] = cols + 1

    return positions


def place_threshold(n_runners: int) -> int:
    """Nombre de places payées par PMU selon la taille du champ."""
    if n_runners >= 8:
        return 3
    if n_runners >= 5:
        return 2
    return 1


def compute_bet_returns(
    bets: list[Bet],
    scenarios_per_race: dict[str, np.ndarray],
    horse_indices: dict[str, dict[str, int]],
) -> np.ndarray:
    """
    Matrice R [n_scenarios, n_bets] des rendements par unité misée.

    R[s, i] = -1           si pari i perd dans scénario s
            = odds_net - 1 si pari i gagne (odds already net of takeout)
    """
    n_scenarios = next(iter(scenarios_per_race.values())).shape[0]
    n_bets = len(bets)
    R = np.full((n_scenarios, n_bets), -1.0)

    for i, bet in enumerate(bets):
        positions = scenarios_per_race[bet.race_id]    # [n_sims, n_runners]
        idx = horse_indices[bet.race_id]
        n_runners = positions.shape[1]

        if bet.bet_type == "simple_gagnant":
            h = idx[bet.selection[0]]
            wins = positions[:, h] == 1

        elif bet.bet_type == "simple_place":
            h = idx[bet.selection[0]]
            wins = positions[:, h] <= place_threshold(n_runners)

        elif bet.bet_type in ("couple_gagnant", "couple_place"):
            h1, h2 = idx[bet.selection[0]], idx[bet.selection[1]]
            if bet.bet_type == "couple_gagnant":
                wins = ((positions[:, h1] <= 2) & (positions[:, h2] <= 2)
                        & (positions[:, h1] != positions[:, h2]))
            else:
                t = place_threshold(n_runners)
                wins = (positions[:, h1] <= t) & (positions[:, h2] <= t)

        elif bet.bet_type == "couple_ordre":
            h1, h2 = idx[bet.selection[0]], idx[bet.selection[1]]
            wins = (positions[:, h1] == 1) & (positions[:, h2] == 2)

        elif bet.bet_type == "trio":
            ids = [idx[h] for h in bet.selection]
            # Tous les 3 dans le top 3
            top3 = positions[:, ids]     # [n_sims, 3]
            wins = (top3 <= 3).all(axis=1)

        elif bet.bet_type == "trio_ordre":
            ids = [idx[h] for h in bet.selection]
            wins = (
                (positions[:, ids[0]] == 1)
                & (positions[:, ids[1]] == 2)
                & (positions[:, ids[2]] == 3)
            )

        elif bet.bet_type in ("quarte_plus", "quinte_plus", "pick5"):
            k = 4 if bet.bet_type == "quarte_plus" else 5
            ids = [idx[h] for h in bet.selection[:k]]
            wins = (positions[:, ids] <= k).all(axis=1)

        else:
            raise NotImplementedError(f"Bet type not supported: {bet.bet_type}")

        R[wins, i] = bet.odds - 1

    return R
