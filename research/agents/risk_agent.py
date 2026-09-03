"""
Risk Agent — classificateur DNF (Did Not Finish) pour les courses d'Obstacle.
Score de risque [0-100] basé sur l'historique de chutes/abandons du cheval.

Pour Plat/Trot : retourne un score de risque simplifié basé sur la forme récente.

POST /score  → RiskSignal par cheval
GET  /health → statut
"""
from __future__ import annotations

import os
from typing import Literal

import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="risk_agent", version="1.0.0")

Discipline = Literal["plat", "trot", "obstacle"]


class RiskRequest(BaseModel):
    race_id: str
    discipline: Discipline
    horses: list[dict]      # [{horse_id, race_histories?: [...]}]


class RiskSignal(BaseModel):
    horse_id: str
    dnf_probability: float      # P(DNF) en [0, 1]
    risk_score: float           # [0, 100], 100=très risqué
    fall_rate_12m: float        # taux chutes/abandons sur 12 mois
    obstacle_experience: int    # nombre de courses obstacle
    risk_tier: str              # low | moderate | high | very_high


class RiskResponse(BaseModel):
    race_id: str
    signals: list[RiskSignal]
    model_version: str = "risk_v1"


# Taux de DNF de référence PMU obstacle (source : statistiques PMU 2022-2024)
_BASE_DNF_OBSTACLE = 0.12    # 12% sur l'ensemble du corpus
_BASE_DNF_PLAT_TROT = 0.02  # 2% (jamais vraiment DNF, mais retraits tardifs)


def _estimate_dnf(
    horse_id: str,
    discipline: Discipline,
    histories: list[dict],
) -> RiskSignal:
    """
    Estime le risque DNF depuis l'historique.

    histories items : {
      finishing_position: int | null,   # null = DNF/abandon
      n_runners: int,
      discipline: str,
      race_date: str,
      fall: bool (optionnel)
    }
    """
    obstacle_races = [
        h for h in histories
        if h.get("discipline", discipline) == "obstacle"
    ]
    n_obstacle = len(obstacle_races)

    if discipline != "obstacle":
        # Plat / Trot : risque faible, basé sur retraits tardifs uniquement
        late_scratches = sum(1 for h in histories if h.get("finishing_position") is None)
        n_total = max(len(histories), 1)
        dnf_rate = late_scratches / n_total
        dnf_prob = (dnf_rate + _BASE_DNF_PLAT_TROT) / 2.0
        risk_score = round(dnf_prob * 100, 2)
        tier = "low" if risk_score < 5 else "moderate"
        return RiskSignal(
            horse_id=horse_id,
            dnf_probability=round(dnf_prob, 4),
            risk_score=risk_score,
            fall_rate_12m=0.0,
            obstacle_experience=0,
            risk_tier=tier,
        )

    # Obstacle : calcul détaillé
    if n_obstacle == 0:
        # Premier départ obstacle = très risqué
        return RiskSignal(
            horse_id=horse_id,
            dnf_probability=0.20,
            risk_score=65.0,
            fall_rate_12m=0.0,
            obstacle_experience=0,
            risk_tier="high",
        )

    dnf_count = sum(
        1 for h in obstacle_races
        if h.get("finishing_position") is None or h.get("fall", False)
    )

    # Taux brut + lissage bayésien avec prior _BASE_DNF_OBSTACLE
    # Prior strength = 5 courses
    prior_strength = 5.0
    dnf_rate_smoothed = (
        dnf_count + prior_strength * _BASE_DNF_OBSTACLE
    ) / (n_obstacle + prior_strength)

    # Decay temporel : les DNF récents comptent double
    from datetime import date, timedelta
    cutoff_12m = (date.today() - timedelta(days=365)).isoformat()
    dnf_12m = sum(
        1 for h in obstacle_races
        if (h.get("finishing_position") is None or h.get("fall", False))
        and h.get("race_date", "9999") >= cutoff_12m
    )
    n_12m = max(sum(1 for h in obstacle_races if h.get("race_date", "9999") >= cutoff_12m), 1)
    fall_rate_12m = dnf_12m / n_12m

    # Score pondéré : 60% taux lissé + 40% taux 12m
    dnf_prob = 0.60 * dnf_rate_smoothed + 0.40 * fall_rate_12m
    dnf_prob = min(dnf_prob, 0.95)

    # Bonus expérience : plus de courses = légère réduction du risque
    experience_bonus = min(0.02 * np.log1p(n_obstacle), 0.04)
    dnf_prob = max(0.01, dnf_prob - experience_bonus)

    risk_score = round(dnf_prob * 100, 2)

    if risk_score < 8:
        tier = "low"
    elif risk_score < 15:
        tier = "moderate"
    elif risk_score < 25:
        tier = "high"
    else:
        tier = "very_high"

    return RiskSignal(
        horse_id=horse_id,
        dnf_probability=round(float(dnf_prob), 4),
        risk_score=risk_score,
        fall_rate_12m=round(float(fall_rate_12m), 4),
        obstacle_experience=n_obstacle,
        risk_tier=tier,
    )


@app.post("/score", response_model=RiskResponse)
async def score(req: RiskRequest) -> RiskResponse:
    signals = [
        _estimate_dnf(
            horse.get("horse_id", ""),
            req.discipline,
            horse.get("race_histories", []),
        )
        for horse in req.horses
    ]
    return RiskResponse(race_id=req.race_id, signals=signals)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "agent": "risk_agent"}
