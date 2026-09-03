"""
Estimation du style de course (leader / presser / closer / sit_and_kick) depuis
les commentaires et l'historique des positions aux bornes chronométriques.

Le prior bayésien par discipline évite les conclusions hâtives sur peu de courses.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal

import numpy as np

Style = Literal["leader", "presser", "closer", "sit_and_kick", "unknown"]

# Vocabulaire expert — position en début de course
_LEADER_KEYWORDS = re.compile(
    r"\b(mène|en tête|parti fort|a mené|s'est installé en tête|set the pace|led)\b",
    re.IGNORECASE,
)
_PRESSER_KEYWORDS = re.compile(
    r"\b(suivi|deuxième|troisième|dans les premiers|pressing|tracked|prominent)\b",
    re.IGNORECASE,
)
_CLOSER_KEYWORDS = re.compile(
    r"\b(venu de loin|milieu de peloton|attardé|mid-field|held up|came from behind)\b",
    re.IGNORECASE,
)
_SIT_KICK_KEYWORDS = re.compile(
    r"\b(dernier|queue du peloton|waited|last|held last|saved ground)\b",
    re.IGNORECASE,
)

# Prior bayésien : distribution a priori par style sur l'ensemble des chevaux de plat
# Reflète que ~25% sont leaders, ~30% pressers, etc.
STYLE_PRIOR: dict[Style, float] = {
    "leader": 0.25,
    "presser": 0.30,
    "closer": 0.30,
    "sit_and_kick": 0.15,
}

# Pseudo-comptes pour le prior (équivalent à 3 courses observées)
PRIOR_STRENGTH = 3.0


@dataclass
class HorseStyle:
    horse_id: str
    style: Style
    leader_prob: float      # P(style = leader | données)
    presser_prob: float
    closer_prob: float
    sit_and_kick_prob: float
    confidence: float       # 0-1, basé sur le nombre de courses observées
    n_races: int


def parse_course_commentary(commentary: str) -> dict[Style, float]:
    """
    Extrait un vecteur de scores bruts (non normalisé) à partir d'un commentaire.
    Retourne des counts de mots-clés par style.
    """
    scores: dict[Style, float] = {
        "leader": 0.0,
        "presser": 0.0,
        "closer": 0.0,
        "sit_and_kick": 0.0,
    }
    if not commentary:
        return scores

    scores["leader"] = float(len(_LEADER_KEYWORDS.findall(commentary)))
    scores["presser"] = float(len(_PRESSER_KEYWORDS.findall(commentary)))
    scores["closer"] = float(len(_CLOSER_KEYWORDS.findall(commentary)))
    scores["sit_and_kick"] = float(len(_SIT_KICK_KEYWORDS.findall(commentary)))
    return scores


def _position_to_style_evidence(
    position_at_1000m: int | None,
    n_runners: int,
) -> dict[Style, float]:
    """
    Convertit la position à 1000m en évidence douce pour chaque style.
    position_at_1000m : rang (1-indexed). None = inconnu.
    """
    if position_at_1000m is None or n_runners <= 0:
        return {"leader": 0.0, "presser": 0.0, "closer": 0.0, "sit_and_kick": 0.0}

    frac = position_at_1000m / max(n_runners, 1)  # 0=tête, 1=queue
    return {
        "leader": max(0.0, 1.0 - 4 * frac),              # top 25%
        "presser": max(0.0, 1.0 - abs(frac - 0.30) * 4), # 20-40%
        "closer": max(0.0, 1.0 - abs(frac - 0.60) * 4),  # 50-70%
        "sit_and_kick": max(0.0, 4 * frac - 3.0),         # bottom 25%
    }


def estimate_horse_style(
    horse_id: str,
    race_histories: list[dict],
) -> HorseStyle:
    """
    Estime le style d'un cheval par blending bayésien sur son historique.

    race_histories : liste de dicts avec clés optionnelles :
      - "commentary" : str
      - "position_at_1000m" : int (rang)
      - "n_runners" : int
      - "finishing_position" : int (pour pondérer les bonnes courses)

    Retourne un HorseStyle avec probabilités postérieures normalisées.
    """
    # Comptes postérieurs = prior strength × prior + evidence
    styles: list[Style] = ["leader", "presser", "closer", "sit_and_kick"]
    posterior: dict[Style, float] = {s: PRIOR_STRENGTH * STYLE_PRIOR[s] for s in styles}

    n_races = len(race_histories)

    for race in race_histories:
        # Commentaire
        commentary_evidence = parse_course_commentary(race.get("commentary", ""))

        # Position chronométrique
        pos_evidence = _position_to_style_evidence(
            race.get("position_at_1000m"),
            race.get("n_runners", 10),
        )

        # Pondération : on fait plus confiance aux bonnes performances
        finish = race.get("finishing_position", 5)
        weight = 1.0 / max(finish, 1) ** 0.5  # √-decay

        total_evidence = sum(
            commentary_evidence[s] + pos_evidence[s] for s in styles
        )

        if total_evidence > 0:
            for s in styles:
                posterior[s] += weight * (commentary_evidence[s] + pos_evidence[s])

    # Normaliser
    total = sum(posterior.values())
    if total <= 0:
        probs = dict(STYLE_PRIOR)
    else:
        probs = {s: posterior[s] / total for s in styles}

    dominant = max(probs, key=lambda k: probs[k])

    # Confiance = 1 − entropie normalisée (0=uniforme, 1=certitude)
    entropy = -sum(p * np.log(p + 1e-12) for p in probs.values())
    max_entropy = np.log(len(styles))
    confidence = float(1.0 - entropy / max_entropy)

    # Ajustement confiance selon le nombre de courses observées
    data_weight = min(1.0, n_races / 5.0)
    confidence *= data_weight

    return HorseStyle(
        horse_id=horse_id,
        style=dominant,
        leader_prob=round(probs["leader"], 4),
        presser_prob=round(probs["presser"], 4),
        closer_prob=round(probs["closer"], 4),
        sit_and_kick_prob=round(probs["sit_and_kick"], 4),
        confidence=round(confidence, 3),
        n_races=n_races,
    )


def style_vector(hs: HorseStyle) -> np.ndarray:
    """Retourne le vecteur [leader, presser, closer, sit_and_kick] pour calculs matriciels."""
    return np.array([hs.leader_prob, hs.presser_prob, hs.closer_prob, hs.sit_and_kick_prob])
