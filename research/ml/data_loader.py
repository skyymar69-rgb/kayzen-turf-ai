"""
Chargement et transformation des données pour l'entraînement Plackett-Luce.
Compatible avec le schéma DB PostgreSQL de kayzen-turf-ai.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sqlalchemy import create_engine, text

# Features disponibles dans le schéma actuel + features ajoutées par les agents
FEATURES = [
    # Scores bruts du modèle actuel (seront générés par les agents en Phase 2)
    "kz_score", "win_probability", "top3_probability", "top5_probability",
    # Marché
    "odds", "log_odds", "market_edge", "favorite_gap",
    # Cheval
    "age", "earnings_normalized", "handicap_weight", "draw",
    # Forme (parsing musique — cf. agents/form_agent.py)
    "music_avg_position", "music_recent_wins", "music_recent_top3",
    "music_dq_count",        # Trot
    "music_fall_count",      # Obstacle
    "music_rebound",
    # Conditions (joints depuis races + weather)
    "going_match_score",
    "distance_fit_score",
    # Connexions
    "jockey_form_30d",
    "trainer_form_30d",
    "driver_form_30d",       # Trot
    # Contexte champ
    "field_size", "field_volatility",
]

DISCIPLINE_DUMMIES = ["disc_plat", "disc_trot", "disc_obstacle"]
ALL_FEATURES = FEATURES + DISCIPLINE_DUMMIES


def make_engine(db_url: str):
    return create_engine(db_url, pool_pre_ping=True)


def load_races(engine, date_min: str, date_max: str) -> pd.DataFrame:
    """
    Retourne un DataFrame long : une ligne = un partant.
    Colonnes clés : race_id, horse_id, finish_position (NaN si DNF/DQ), + features.
    """
    query = text("""
        SELECT
            r.id          AS race_id,
            r.race_date,
            r.discipline,
            r.distance,
            r.going,
            e.horse_id,
            e.kz_score,
            e.win_probability,
            e.top3_probability,
            e.top5_probability,
            e.odds,
            e.age,
            e.earnings,
            e.handicap_distance  AS handicap_weight,
            e.draw,
            e.music,
            e.reduction_km,
            res.finish_position
        FROM races r
        JOIN entries e ON e.race_id = r.id
        LEFT JOIN results res ON res.race_id = r.id AND res.horse_id = e.horse_id
        WHERE r.race_date BETWEEN :d1 AND :d2
          AND r.country = 'FRA'
        ORDER BY r.race_date, r.id, e.draw
    """)

    with engine.connect() as conn:
        df = pd.read_sql(query, conn, params={"d1": date_min, "d2": date_max})

    # Derived features
    df["log_odds"] = np.log(df["odds"].clip(lower=1.01))
    df["market_edge"] = (df["win_probability"] / 100) * df["odds"] - 1
    df["earnings_normalized"] = df.groupby("race_id")["earnings"].transform(
        lambda x: x / x.max().clip(lower=1)
    )
    df["favorite_gap"] = df.groupby("race_id")["odds"].transform(lambda x: x - x.min())
    df["field_size"] = df.groupby("race_id")["horse_id"].transform("count")
    df["field_volatility"] = df.groupby("race_id")["odds"].transform("std").fillna(0)

    # Music features (simplified — full parsing in form_agent)
    df = _parse_music_features(df)

    # Going match score (0-1: how well going fits horse history)
    df["going_match_score"] = 0.5  # placeholder — conditioned on agent enrichment
    df["distance_fit_score"] = 0.5
    df["jockey_form_30d"] = 0.0
    df["trainer_form_30d"] = 0.0
    df["driver_form_30d"] = 0.0

    # One-hot discipline
    for disc in ["plat", "trot", "obstacle"]:
        df[f"disc_{disc}"] = (df["discipline"].str.lower() == disc).astype(int)

    return df


def _parse_music_features(df: pd.DataFrame) -> pd.DataFrame:
    """Extract basic music signals. Full parser lives in form_agent."""
    def parse_one(row):
        music = str(row.get("music") or "").upper()
        chars = list(music[:8])
        positions = [int(c) for c in chars if c.isdigit() and c != "0"]
        dq_count = sum(1 for c in chars if c in {"0", "D"}) if row.get("discipline", "").lower() == "trot" else 0
        fall_count = sum(1 for c in chars if c in {"F", "T", "U", "P", "R"}) if row.get("discipline", "").lower() == "obstacle" else 0
        avg_pos = float(np.mean(positions)) if positions else 8.0
        recent = chars[:3]
        recent_nums = [int(c) for c in recent if c.isdigit() and c != "0"]
        rebound = int(len(positions) >= 2 and positions[0] <= 4 and any(v >= 7 for v in positions[1:4]))
        return {
            "music_avg_position": avg_pos,
            "music_recent_wins": sum(1 for v in recent_nums if v == 1),
            "music_recent_top3": sum(1 for v in recent_nums if v <= 3),
            "music_dq_count": dq_count,
            "music_fall_count": fall_count,
            "music_rebound": rebound,
        }

    music_feats = df.apply(parse_one, axis=1, result_type="expand")
    return pd.concat([df, music_feats], axis=1)


def to_ranking_format(df: pd.DataFrame) -> tuple:
    """
    Format LightGBM lambdarank:
      X      : matrice features (N partants × F)
      y      : relevance décroissante avec position (top-5 scoring)
      group  : nombre de partants par course
      qid    : race_id pour split temporel
    """
    df = df.sort_values(["race_date", "race_id"]).reset_index(drop=True)
    X = df[ALL_FEATURES].fillna(df[ALL_FEATURES].median(numeric_only=True)).values.astype(np.float32)

    K = 5
    pos = df["finish_position"].fillna(99).astype(int).values
    y = np.where(pos == 1, K,
        np.where(pos == 2, K - 1,
        np.where(pos == 3, K - 2,
        np.where(pos == 4, K - 3,
        np.where(pos == 5, K - 4, 0)))))

    group = df.groupby("race_id", sort=False).size().values
    qid = df["race_id"].values
    return X, y.astype(np.int32), group, qid
