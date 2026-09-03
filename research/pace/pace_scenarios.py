"""
Calcul de l'indice de pression de rythme (PPI) d'une course et classification
du scénario de course (slow / moderate / hot / very_hot).

PPI = Σ_i  leader_prob_i × confidence_i  /  (0.30 × n_runners)
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np

from pace.style_estimation import HorseStyle

PaceScenario = Literal["slow", "moderate", "hot", "very_hot"]

# Seuils empiriques PMU Plat (calibrés sur 3 saisons)
PPI_THRESHOLDS = [
    (0.00, 0.60, "slow"),
    (0.60, 0.90, "moderate"),
    (0.90, 1.20, "hot"),
    (1.20, 9.99, "very_hot"),
]


@dataclass
class PaceProfile:
    pace_scenario: PaceScenario
    ppi: float                  # Pace Pressure Index
    n_likely_leaders: float     # Espérance du nombre de leaders
    front_prob_mean: float      # Proba moyenne d'être devant à 1000m
    distance_m: int
    n_runners: int


def compute_pace_pressure(
    horse_styles: list[HorseStyle],
    distance_m: int = 2000,
) -> PaceProfile:
    """
    Calcule le PPI et le scénario de rythme pour une course.

    PPI :
      - Numérateur   : Σ leader_prob_i × confidence_i
      - Dénominateur : 0.30 × n_runners  (normalisation : 30% = quota "normal" de leaders)

    La distance module légèrement le seuil : les sprints (<1400m) sont
    naturellement plus rapides, les longues distances plus tactiques.
    """
    n = len(horse_styles)
    if n == 0:
        return PaceProfile("slow", 0.0, 0.0, 0.0, distance_m, 0)

    front_probs = np.array([
        hs.leader_prob * hs.confidence for hs in horse_styles
    ])

    ppi_raw = float(front_probs.sum()) / (0.30 * n)

    # Correction distance : sprint (<1400m) +15%, longue (>2400m) −10%
    if distance_m < 1400:
        ppi = ppi_raw * 1.15
    elif distance_m > 2400:
        ppi = ppi_raw * 0.90
    else:
        ppi = ppi_raw

    scenario: PaceScenario = "moderate"
    for lo, hi, name in PPI_THRESHOLDS:
        if lo <= ppi < hi:
            scenario = name  # type: ignore[assignment]
            break

    n_likely_leaders = float(
        sum(hs.leader_prob for hs in horse_styles)
    )
    front_prob_mean = float(
        np.mean([hs.leader_prob + hs.presser_prob for hs in horse_styles])
    )

    return PaceProfile(
        pace_scenario=scenario,
        ppi=round(ppi, 3),
        n_likely_leaders=round(n_likely_leaders, 2),
        front_prob_mean=round(front_prob_mean, 3),
        distance_m=distance_m,
        n_runners=n,
    )


def pace_scenario_to_index(scenario: PaceScenario) -> int:
    """Indice numérique du scénario pour indexer la matrice PACE_ADJUSTMENT."""
    return {"slow": 0, "moderate": 1, "hot": 2, "very_hot": 3}[scenario]
