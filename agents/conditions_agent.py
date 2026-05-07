"""
Conditions Agent — intègre terrain × distance × pace pour scorer les conditions
de course par rapport au profil historique de chaque cheval.

Pour les courses de Plat ≥ 1600m, appelle le module pace pour calculer delta_p_win.

POST /score  → ConditionsSignal par cheval
GET  /health → statut
"""
from __future__ import annotations

import os
from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="conditions_agent", version="1.0.0")

Going = Literal["lourd", "tres_souple", "souple", "bon_souple", "bon", "bon_dur", "dur", "ferme"]
Discipline = Literal["plat", "trot", "obstacle"]


class ConditionsRequest(BaseModel):
    race_id: str
    discipline: Discipline
    distance_m: int
    going: Going
    horses: list[dict]      # [{horse_id, pl_score, race_histories?: [...]}]


class ConditionsSignal(BaseModel):
    horse_id: str
    going_affinity: float       # [−1, +1] affinité historique terrain
    distance_affinity: float    # [−1, +1] affinité historique distance
    pace_delta_p_win: float     # delta de P(win) du module pace (Plat uniquement)
    pace_delta_p_top3: float
    pace_scenario: str          # slow/moderate/hot/very_hot ou "n/a"
    conditions_score: float     # score agrégé [−100, 100]


class ConditionsResponse(BaseModel):
    race_id: str
    signals: list[ConditionsSignal]
    pace_applied: bool
    model_version: str = "conditions_v1"


# Mapping terrain → valeur numérique (0=lourd, 1=ferme)
GOING_VALUES: dict[str, float] = {
    "lourd": 0.0, "tres_souple": 0.15, "souple": 0.30, "bon_souple": 0.45,
    "bon": 0.60, "bon_dur": 0.70, "dur": 0.85, "ferme": 1.0,
}

# Plage distances par discipline
DISTANCE_RANGES: dict[str, tuple[int, int]] = {
    "plat": (800, 3200),
    "trot": (1600, 4500),
    "obstacle": (2000, 7000),
}


def _going_affinity(going: Going, horse_histories: list[dict]) -> float:
    """
    Affinité terrain : corrélation entre going_value des courses et performance.
    Retourne valeur [−1, +1].
    """
    if not horse_histories:
        return 0.0

    going_val = GOING_VALUES.get(going, 0.5)
    history_vals = []
    results = []

    for race in horse_histories:
        g = race.get("going", "bon")
        pos = race.get("finishing_position", 5)
        n = max(race.get("n_runners", 5), 2)
        history_vals.append(GOING_VALUES.get(g, 0.5))
        results.append(1.0 - (pos - 1) / (n - 1))   # 1=victoire, 0=dernier

    if not history_vals:
        return 0.0

    import numpy as np
    arr_g = np.array(history_vals)
    arr_r = np.array(results)
    if arr_g.std() < 1e-6:
        return 0.0

    corr = float(np.corrcoef(arr_g, arr_r)[0, 1])
    # Poids selon proximité terrain actuel
    proximity = 1.0 - abs(going_val - arr_g).mean()
    return round(corr * proximity, 3)


def _distance_affinity(distance_m: int, horse_histories: list[dict]) -> float:
    """
    Affinité distance : Gaussian kernel autour des distances gagnées.
    Retourne [−1, +1].
    """
    if not horse_histories:
        return 0.0

    import numpy as np
    sigma = 300.0   # mètres — bande typique de spécialisation
    wins = [r["distance_m"] for r in horse_histories if r.get("finishing_position") == 1 and r.get("distance_m")]

    if not wins:
        # Aucune victoire connue — affinité neutre
        return 0.0

    dists = np.array(wins)
    kernel = np.exp(-0.5 * ((distance_m - dists) / sigma) ** 2)
    return round(float(kernel.mean() * 2 - 1), 3)   # [0,1] → [−1,+1]


async def _compute_pace_signals(
    discipline: Discipline,
    distance_m: int,
    horses: list[dict],
) -> tuple[list[dict], str]:
    """
    Appelle le module pace pour Plat ≥ 1600m uniquement.
    Retourne (liste de {horse_id, delta_p_win, delta_p_top3}, scenario_name).
    """
    if discipline != "plat" or distance_m < 1600:
        return [{
            "horse_id": h["horse_id"],
            "delta_p_win": 0.0,
            "delta_p_top3": 0.0,
        } for h in horses], "n/a"

    try:
        from pace.style_estimation import estimate_horse_style
        from pace.pace_scenarios import compute_pace_pressure
        from pace.monte_carlo import HorsePaceProfile, simulate_with_pace, compute_pace_delta

        horse_styles = [
            estimate_horse_style(h["horse_id"], h.get("race_histories", []))
            for h in horses
        ]
        pace_profile = compute_pace_pressure(horse_styles, distance_m)

        profiles = [
            HorsePaceProfile(
                horse_id=h["horse_id"],
                pl_score_baseline=float(h.get("pl_score", 50.0)),
                style=horse_styles[i],
            )
            for i, h in enumerate(horses)
        ]
        simulated = simulate_with_pace(profiles, pace_profile)

        deltas = []
        for h in horses:
            d = compute_pace_delta(h["horse_id"], simulated)
            deltas.append({"horse_id": h["horse_id"], **d})

        return deltas, pace_profile.pace_scenario

    except Exception:
        return [{
            "horse_id": h["horse_id"],
            "delta_p_win": 0.0,
            "delta_p_top3": 0.0,
        } for h in horses], "n/a"


@app.post("/score", response_model=ConditionsResponse)
async def score(req: ConditionsRequest) -> ConditionsResponse:
    pace_deltas, pace_scenario = await _compute_pace_signals(
        req.discipline, req.distance_m, req.horses
    )
    pace_map = {d["horse_id"]: d for d in pace_deltas}

    signals = []
    for horse in req.horses:
        hid = horse.get("horse_id", "")
        histories = horse.get("race_histories", [])

        ga = _going_affinity(req.going, histories)
        da = _distance_affinity(req.distance_m, histories)
        pd = pace_map.get(hid, {"delta_p_win": 0.0, "delta_p_top3": 0.0})

        cond_score = round(
            40.0 * ga + 30.0 * da + 30.0 * (pd["delta_p_win"] / 10.0),
            2,
        )

        signals.append(ConditionsSignal(
            horse_id=hid,
            going_affinity=ga,
            distance_affinity=da,
            pace_delta_p_win=pd["delta_p_win"],
            pace_delta_p_top3=pd.get("delta_p_top3", 0.0),
            pace_scenario=pace_scenario,
            conditions_score=cond_score,
        ))

    return ConditionsResponse(
        race_id=req.race_id,
        signals=signals,
        pace_applied=(pace_scenario != "n/a"),
    )


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "agent": "conditions_agent"}
