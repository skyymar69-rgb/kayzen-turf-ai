"""
Simulation Monte Carlo du rythme de course pour le Plat.

Principe :
  1. Chaque cheval a un profil de style (vecteur de probas sur 4 styles).
  2. On tire aléatoirement le style réalisé pour chaque cheval dans chaque simulation.
  3. La matrice PACE_ADJUSTMENT[scenario][style] donne le delta de score PL.
  4. On re-normalise via Plackett-Luce et on calcule la différence de P(top-K) vs baseline.

Le delta_p_win obtenu est passé comme feature au meta-learner (Option 1 recommandée).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from pace.pace_scenarios import PaceProfile, pace_scenario_to_index
from pace.style_estimation import HorseStyle, style_vector

# ─────────────────────────────────────────────────────────────────────────────
# Matrice d'ajustement [n_scenarios × n_styles] — deltas additifs sur score PL
#
# Lignes  : 0=slow | 1=moderate | 2=hot | 3=very_hot
# Colonnes: 0=leader | 1=presser | 2=closer | 3=sit_and_kick
#
# Valeurs calibrées sur données historiques (voir pace/calibration.py).
# Interprétation : +3 pour un leader dans un rythme lent = il sera encore moins
# challengé, donc son avantage de position est amplifié.
# ─────────────────────────────────────────────────────────────────────────────
PACE_ADJUSTMENT = np.array([
    # slow   moderate  hot    very_hot      ← scenario
    [+3.0,   +1.5,   -2.0,   -4.0],  # leader
    [+1.0,   +0.5,   +0.5,   -1.0],  # presser
    [-1.0,   +0.0,   +2.0,   +3.5],  # closer
    [-2.0,   -0.5,   +3.0,   +5.0],  # sit_and_kick
], dtype=np.float64)  # shape [4_styles, 4_scenarios]

# Température PL identique à prediction-math.ts
PL_TEMPERATURE = 10.0
N_SIM_DEFAULT = 2000


@dataclass
class HorsePaceProfile:
    horse_id: str
    pl_score_baseline: float        # score PL avant ajustement pace
    style: HorseStyle
    delta_p_win: float = 0.0        # impact du pace sur P(win) en points de %
    delta_p_top3: float = 0.0
    delta_p_top5: float = 0.0


def _gumbel_samples(n_runners: int, n_sim: int, rng: np.random.Generator) -> np.ndarray:
    """Gumbel(0,1) iid — [n_sim, n_runners]."""
    return rng.gumbel(size=(n_sim, n_runners))


def _pl_softmax(scores: np.ndarray) -> np.ndarray:
    """Softmax avec température — retourne probas P(win) [n_runners]."""
    s = scores / PL_TEMPERATURE
    e = np.exp(s - s.max())
    return e / e.sum()


def _monte_carlo_topk(
    scores: np.ndarray,
    ks: tuple[int, int, int],
    n_sim: int,
    rng: np.random.Generator,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Gumbel-max trick : [n_sim, n_runners] → probas top-1, top-K1, top-K2.
    Retourne 3 vecteurs de probas [n_runners] pour k = ks[0], ks[1], ks[2].
    """
    n = len(scores)
    k1, k2, k3 = ks
    maxk = max(ks)
    scaled = scores / PL_TEMPERATURE
    gumbel = _gumbel_samples(n, n_sim, rng)
    perturbed = scaled[None, :] + gumbel            # [n_sim, n_runners]
    order = np.argsort(-perturbed, axis=1)           # [n_sim, n_runners]

    c1 = np.zeros(n)
    c2 = np.zeros(n)
    c3 = np.zeros(n)
    for pos in range(maxk):
        idx = order[:, pos]
        if pos < k1:
            np.add.at(c1, idx, 1)
        if pos < k2:
            np.add.at(c2, idx, 1)
        if pos < k3:
            np.add.at(c3, idx, 1)

    return c1 / n_sim, c2 / n_sim, c3 / n_sim


def simulate_with_pace(
    profiles: list[HorsePaceProfile],
    pace_profile: PaceProfile,
    n_sim: int = N_SIM_DEFAULT,
    seed: int = 42,
) -> list[HorsePaceProfile]:
    """
    Simule n_sim courses avec ajustements pace et calcule les deltas de probabilité.

    Pour chaque simulation :
      1. Tire le style réalisé de chaque cheval selon sa distribution.
      2. Calcule l'ajustement = PACE_ADJUSTMENT[scenario_idx][style_réalisé].
      3. Accumule les scores ajustés pour la MC top-K.

    Retourne les profils avec delta_p_win / delta_p_top3 / delta_p_top5 remplis.
    """
    n = len(profiles)
    if n == 0:
        return profiles

    rng = np.random.default_rng(seed)
    scenario_idx = pace_scenario_to_index(pace_profile.pace_scenario)

    baseline_scores = np.array([p.pl_score_baseline for p in profiles])

    # Probas de style pour chaque cheval [n, 4]
    style_matrix = np.array([style_vector(p.style) for p in profiles])

    # Baseline probas
    p_win_base, p_top3_base, p_top5_base = _monte_carlo_topk(
        baseline_scores, (1, 3, 5), n_sim, rng
    )

    # Simulation pace — on accumule les scores ajustés sur n_sim runs
    adjusted_top1 = np.zeros(n)
    adjusted_top3 = np.zeros(n)
    adjusted_top5 = np.zeros(n)

    # Tirage des styles réalisés pour toutes les simulations [n_sim, n]
    style_samples = np.array([
        rng.choice(4, size=n_sim, p=style_matrix[i])
        for i in range(n)
    ]).T  # [n_sim, n]

    # Ajustements par simulation — vectorisé
    # PACE_ADJUSTMENT est [4_styles, 4_scenarios] → on transpose pour [4_scenarios, 4_styles]
    adj_matrix = PACE_ADJUSTMENT.T[scenario_idx]  # [4_styles] → delta par style pour ce scenario

    # Calcul ajustements [n_sim, n]
    pace_deltas = adj_matrix[style_samples]  # [n_sim, n]
    adjusted_scores_all = baseline_scores[None, :] + pace_deltas  # [n_sim, n]

    # MC top-K sur scores ajustés — optimisé par batch
    maxk = 5
    gumbel = _gumbel_samples(n, n_sim, rng)
    perturbed = adjusted_scores_all / PL_TEMPERATURE + gumbel   # [n_sim, n]
    order = np.argsort(-perturbed, axis=1)

    c1 = np.zeros(n)
    c3 = np.zeros(n)
    c5 = np.zeros(n)
    for pos in range(maxk):
        idx_col = order[:, pos]
        if pos < 1:
            np.add.at(c1, idx_col, 1)
        if pos < 3:
            np.add.at(c3, idx_col, 1)
        if pos < 5:
            np.add.at(c5, idx_col, 1)

    adjusted_top1 = c1 / n_sim
    adjusted_top3 = c3 / n_sim
    adjusted_top5 = c5 / n_sim

    result = []
    for i, profile in enumerate(profiles):
        result.append(HorsePaceProfile(
            horse_id=profile.horse_id,
            pl_score_baseline=profile.pl_score_baseline,
            style=profile.style,
            delta_p_win=round(float((adjusted_top1[i] - p_win_base[i]) * 100), 2),
            delta_p_top3=round(float((adjusted_top3[i] - p_top3_base[i]) * 100), 2),
            delta_p_top5=round(float((adjusted_top5[i] - p_top5_base[i]) * 100), 2),
        ))

    return result


def compute_pace_delta(
    horse_id: str,
    profiles: list[HorsePaceProfile],
) -> dict[str, float]:
    """
    Extrait les deltas pour un cheval spécifique — interface pour le meta-learner.
    Retourne {"delta_p_win": ..., "delta_p_top3": ..., "delta_p_top5": ...}
    ou zéros si non trouvé.
    """
    for p in profiles:
        if p.horse_id == horse_id:
            return {
                "delta_p_win": p.delta_p_win,
                "delta_p_top3": p.delta_p_top3,
                "delta_p_top5": p.delta_p_top5,
            }
    return {"delta_p_win": 0.0, "delta_p_top3": 0.0, "delta_p_top5": 0.0}
