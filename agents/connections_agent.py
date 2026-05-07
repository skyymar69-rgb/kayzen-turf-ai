"""
Connections Agent — forme récente du jockey, de l'entraîneur (Plat/Obstacle)
et du driver (Trot).

POST /score  → ConnectionSignal par cheval
GET  /health → statut
"""
from __future__ import annotations

import os
from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="connections_agent", version="1.0.0")

Discipline = Literal["plat", "trot", "obstacle"]


class ConnectionsRequest(BaseModel):
    race_id: str
    discipline: Discipline
    horses: list[dict]      # [{horse_id, jockey_id, trainer_id, driver_id?}]
    lookback_days: int = 90


class ConnectionSignal(BaseModel):
    horse_id: str
    jockey_win_rate_14d: float   # % wins sur 14 derniers jours
    jockey_win_rate_90d: float
    trainer_win_rate_90d: float
    driver_win_rate_90d: float   # trot uniquement (0.0 sinon)
    jockey_course_affinity: float   # win rate jockey × cheval (combo)
    connection_score: float          # score agrégé [0-100]
    data_source: str = "db"


class ConnectionsResponse(BaseModel):
    race_id: str
    signals: list[ConnectionSignal]
    model_version: str = "connections_v1"


async def _query_jockey_stats(
    jockey_id: str,
    discipline: Discipline,
    lookback_days: int,
    db_url: str,
) -> dict:
    """Requête DB pour le win rate jockey sur la période."""
    try:
        import psycopg
        async with await psycopg.AsyncConnection.connect(db_url) as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    SELECT
                        COUNT(*) FILTER (WHERE finishing_position = 1)::float / NULLIF(COUNT(*), 0) AS wr_90d,
                        COUNT(*) FILTER (WHERE finishing_position = 1 AND race_date >= CURRENT_DATE - INTERVAL '14 days')::float
                            / NULLIF(COUNT(*) FILTER (WHERE race_date >= CURRENT_DATE - INTERVAL '14 days'), 0) AS wr_14d
                    FROM race_results
                    WHERE jockey_id = %s
                      AND discipline = %s
                      AND race_date >= CURRENT_DATE - INTERVAL '%s days'
                    """,
                    (jockey_id, discipline, lookback_days),
                )
                row = await cur.fetchone()
        if row:
            return {"wr_90d": float(row[0] or 0.0), "wr_14d": float(row[1] or 0.0)}
    except Exception:
        pass
    return {"wr_90d": 0.0, "wr_14d": 0.0}


async def _query_trainer_stats(trainer_id: str, discipline: Discipline, db_url: str) -> float:
    try:
        import psycopg
        async with await psycopg.AsyncConnection.connect(db_url) as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    SELECT COUNT(*) FILTER (WHERE finishing_position = 1)::float / NULLIF(COUNT(*), 0)
                    FROM race_results
                    WHERE trainer_id = %s AND discipline = %s
                      AND race_date >= CURRENT_DATE - INTERVAL '90 days'
                    """,
                    (trainer_id, discipline),
                )
                row = await cur.fetchone()
        return float(row[0] or 0.0) if row else 0.0
    except Exception:
        return 0.0


def _compute_connection_score(
    jwr_14d: float,
    jwr_90d: float,
    twr: float,
    dwr: float,
    affinity: float,
    discipline: Discipline,
) -> float:
    """Score agrégé [0-100] avec pondération par discipline."""
    if discipline == "trot":
        score = (
            0.25 * jwr_14d * 100
            + 0.20 * jwr_90d * 100
            + 0.25 * dwr * 100
            + 0.20 * twr * 100
            + 0.10 * affinity * 100
        )
    elif discipline == "obstacle":
        score = (
            0.30 * jwr_14d * 100
            + 0.25 * jwr_90d * 100
            + 0.30 * twr * 100
            + 0.15 * affinity * 100
        )
    else:  # plat
        score = (
            0.35 * jwr_14d * 100
            + 0.25 * jwr_90d * 100
            + 0.25 * twr * 100
            + 0.15 * affinity * 100
        )
    return round(min(score, 100.0), 2)


@app.post("/score", response_model=ConnectionsResponse)
async def score(req: ConnectionsRequest) -> ConnectionsResponse:
    db_url = os.environ.get("DATABASE_URL", "")
    signals = []

    for horse in req.horses:
        hid = horse.get("horse_id", "")
        jockey_id = horse.get("jockey_id", "")
        trainer_id = horse.get("trainer_id", "")
        driver_id = horse.get("driver_id", "")

        if db_url:
            j_stats = await _query_jockey_stats(jockey_id, req.discipline, req.lookback_days, db_url)
            t_wr = await _query_trainer_stats(trainer_id, req.discipline, db_url)
            d_wr = await _query_trainer_stats(driver_id, req.discipline, db_url) if driver_id else 0.0
        else:
            j_stats = {"wr_90d": 0.0, "wr_14d": 0.0}
            t_wr = 0.0
            d_wr = 0.0

        affinity = (j_stats["wr_90d"] + t_wr) / 2.0
        conn_score = _compute_connection_score(
            j_stats["wr_14d"], j_stats["wr_90d"], t_wr, d_wr, affinity, req.discipline
        )

        signals.append(ConnectionSignal(
            horse_id=hid,
            jockey_win_rate_14d=round(j_stats["wr_14d"], 4),
            jockey_win_rate_90d=round(j_stats["wr_90d"], 4),
            trainer_win_rate_90d=round(t_wr, 4),
            driver_win_rate_90d=round(d_wr, 4),
            jockey_course_affinity=round(affinity, 4),
            connection_score=conn_score,
            data_source="db" if db_url else "stub",
        ))

    return ConnectionsResponse(race_id=req.race_id, signals=signals)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "agent": "connections_agent"}
