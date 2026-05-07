"""
Contrats Pydantic partagés par tous les agents.
Garanties contractuelles : data_cutoff_at, model_version, git_sha, features_used.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

Discipline = Literal["plat", "trot", "obstacle"]


class Runner(BaseModel):
    horse_id: str
    horse_name: str
    draw: int                                   # numéro de partant
    odds: float
    music: str = ""
    age: int
    sex: Literal["M", "F", "H"] = "M"
    earnings_eur: float = 0.0
    handicap_weight: Optional[float] = None
    reduction_km: Optional[str] = None          # Trot uniquement
    jockey_id: str = ""
    trainer_id: str = ""
    driver_id: Optional[str] = None             # Trot
    equipment: list[str] = []


class RaceContext(BaseModel):
    race_id: str
    race_date: datetime
    discipline: Discipline
    distance_m: int
    going: str
    weather: dict = {}
    runners: list[Runner]

    @property
    def field_size(self) -> int:
        return len(self.runners)


class AgentSignal(BaseModel):
    horse_id: str
    score: float                                # raw PL log-strength — exp() = θ_i
    confidence: float = Field(ge=0.0, le=1.0)
    features_used: dict                         # inputs exact pour audit ANJ
    sub_signals: dict = {}                      # détail interne optionnel


class AgentResponse(BaseModel):
    agent_name: str
    model_version: str                          # SHA du fichier modèle
    git_sha: str                                # SHA du code au moment du déploiement
    data_cutoff_at: datetime                    # aucune feature postérieure à cette date
    signals: list[AgentSignal]
    warnings: list[str] = []
    latency_ms: float


class PredictionResult(BaseModel):
    """Sortie finale de l'orchestrateur après meta-learning + calibration PL."""
    race_id: str
    generated_at: datetime
    horses: list[HorsePredictionOut]
    model_versions: dict[str, Optional[str]]
    data_cutoff_at: datetime
    warnings: list[str] = []


class HorsePredictionOut(BaseModel):
    horse_id: str
    horse_name: str
    p_win: float                                # PL calibré [0-1]
    p_top3: float                               # PL calibré, garantit p_top3 ≥ p_win
    p_top5: float                               # PL calibré, garantit p_top5 ≥ p_top3
    kz_score: int                               # 1–99 compatible frontend
    market_edge_pct: float                      # EV pari-mutuel avec prélèvement
    agent_breakdown: dict[str, Optional[float]] # score brut par agent


# Resolve forward reference
PredictionResult.model_rebuild()
