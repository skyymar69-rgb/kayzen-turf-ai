"""
Market Agent — signaux drift/steam depuis les snapshots de cotes PMU.

Cache 5-min en mémoire pour éviter les requêtes répétées à la DB.
POST /signals  → DriftSignals pour une liste de chevaux
GET  /health   → statut + timestamp dernier snapshot
"""
from __future__ import annotations

import asyncio
import os
import time
from typing import Any

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="market_agent", version="1.0.0")

# ─────────────────────────────────────────────────────────────────────────────
# Cache 5-min
# ─────────────────────────────────────────────────────────────────────────────
_cache: dict[str, tuple[float, Any]] = {}
_CACHE_TTL = 300.0  # secondes


def _cache_get(key: str) -> Any | None:
    entry = _cache.get(key)
    if entry and (time.time() - entry[0]) < _CACHE_TTL:
        return entry[1]
    return None


def _cache_set(key: str, value: Any) -> None:
    _cache[key] = (time.time(), value)


# ─────────────────────────────────────────────────────────────────────────────
# Schémas
# ─────────────────────────────────────────────────────────────────────────────

class SignalsRequest(BaseModel):
    race_id: str
    horse_ids: list[str]
    decision_time: str      # ISO-8601


class HorseDriftSignal(BaseModel):
    horse_id: str
    steam_score: float
    drift_score: float
    smart_money_signal: float
    late_acceleration: float
    market_signal: str      # neutral | steam_moderate | steam_strong | drift_moderate | drift_red_flag | smart_money_steam | late_activity_unusual
    velocity_30m: float
    predicted_odds_close: float | None = None


class SignalsResponse(BaseModel):
    race_id: str
    decision_time: str
    signals: list[HorseDriftSignal]
    model_version: str = "drift_lgbm_v1"
    source: str = "market_agent"


# ─────────────────────────────────────────────────────────────────────────────
# Core
# ─────────────────────────────────────────────────────────────────────────────

async def _load_snapshots(race_id: str) -> "pd.DataFrame | None":
    """Charge les snapshots de cotes depuis la DB (stub prod)."""
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        return None
    try:
        import pandas as pd
        import psycopg
        async with await psycopg.AsyncConnection.connect(db_url) as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    SELECT horse_id, odds, observed_at, minutes_to_off, pool_eur
                    FROM odds_snapshots
                    WHERE race_id = %s AND bet_type = 'simple_gagnant'
                    ORDER BY observed_at ASC
                    """,
                    (race_id,),
                )
                rows = await cur.fetchall()
        if not rows:
            return None
        return pd.DataFrame(rows, columns=["horse_id", "odds", "observed_at", "minutes_to_off", "pool_eur"])
    except Exception:
        return None


def _compute_signals_from_snapshots(
    snapshots,          # pd.DataFrame
    horse_ids: list[str],
    decision_time_str: str,
) -> list[HorseDriftSignal]:
    """Applique features drift + détection steam sur les snapshots."""
    try:
        import pandas as pd
        from features.drift_features import build_drift_features
        from models.odds_drift_model import predict_close
        from signals.steam_drift import detect_market_signals

        decision_time = pd.Timestamp(decision_time_str, tz="UTC")
        features_df = build_drift_features(snapshots, decision_time=decision_time)

        if features_df.empty:
            return _neutral_signals(horse_ids)

        signals_df = detect_market_signals(features_df)

        # Prédiction cote de fermeture
        model_path = os.environ.get("DRIFT_MODEL_PATH", "models/drift_lgbm.pkl")
        import pickle, pathlib
        model = None
        if pathlib.Path(model_path).exists():
            with open(model_path, "rb") as f:
                model = pickle.load(f)

        result = []
        for hid in horse_ids:
            row = signals_df[signals_df["horse_id"] == hid]
            if row.empty:
                result.append(HorseDriftSignal(
                    horse_id=hid, steam_score=0.0, drift_score=0.0,
                    smart_money_signal=0.0, late_acceleration=0.0,
                    market_signal="neutral", velocity_30m=0.0,
                ))
                continue
            r = row.iloc[0]
            predicted_close = None
            if model is not None:
                feat_row = features_df[features_df["horse_id"] == hid]
                if not feat_row.empty:
                    pred = predict_close(model, feat_row)
                    predicted_close = float(pred["predicted_odds_close"].iloc[0]) if not pred.empty else None
            result.append(HorseDriftSignal(
                horse_id=hid,
                steam_score=float(r.get("steam_score", 0.0)),
                drift_score=float(r.get("drift_score", 0.0)),
                smart_money_signal=float(r.get("smart_money_signal", 0.0)),
                late_acceleration=float(r.get("late_acceleration", 0.0)),
                market_signal=str(r.get("market_signal", "neutral")),
                velocity_30m=float(r.get("velocity_30m", 0.0)),
                predicted_odds_close=predicted_close,
            ))
        return result
    except Exception:
        return _neutral_signals(horse_ids)


def _neutral_signals(horse_ids: list[str]) -> list[HorseDriftSignal]:
    return [
        HorseDriftSignal(
            horse_id=hid, steam_score=0.0, drift_score=0.0,
            smart_money_signal=0.0, late_acceleration=0.0,
            market_signal="neutral", velocity_30m=0.0,
        )
        for hid in horse_ids
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/signals", response_model=SignalsResponse)
async def get_signals(req: SignalsRequest) -> SignalsResponse:
    cache_key = f"{req.race_id}:{req.decision_time}"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    snapshots = await _load_snapshots(req.race_id)
    if snapshots is None:
        signals = _neutral_signals(req.horse_ids)
    else:
        signals = _compute_signals_from_snapshots(snapshots, req.horse_ids, req.decision_time)

    response = SignalsResponse(
        race_id=req.race_id,
        decision_time=req.decision_time,
        signals=signals,
    )
    _cache_set(cache_key, response)
    return response


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "agent": "market_agent", "cache_entries": len(_cache)}
