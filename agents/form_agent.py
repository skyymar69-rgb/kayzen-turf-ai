"""
form_agent — signal forme cheval via LightGBM Plackett-Luce.
Cycle : quotidien (J-1). Cache TTL : 24h par (race_id, model_version).
"""
from __future__ import annotations

import hashlib
import os
import time
from datetime import datetime, timezone

import lightgbm as lgb
import numpy as np
from fastapi import FastAPI, HTTPException
from contracts import AgentResponse, AgentSignal, RaceContext

app = FastAPI(title="form_agent", version="1.0.0")

MODEL_PATH = os.environ.get("FORM_MODEL_PATH", "models/form/lgbm-pl-v1.0.lgb")
GIT_SHA = os.environ.get("GIT_SHA", "dev")

try:
    _model_bytes = open(MODEL_PATH, "rb").read()
    MODEL_VERSION = hashlib.sha256(_model_bytes).hexdigest()[:12]
    MODEL = lgb.Booster(model_file=MODEL_PATH)
    print(f"[form_agent] model loaded — version={MODEL_VERSION}")
except FileNotFoundError:
    MODEL = None
    MODEL_VERSION = "not-loaded"
    print(f"[form_agent] WARNING: model not found at {MODEL_PATH} — serving mock scores")

FEATURE_NAMES = [
    "music_avg_position", "music_dq_count", "music_fall_count",
    "music_recent_wins", "music_recent_top3", "music_rebound",
    "age", "earnings_eur_log", "handicap_weight", "reduction_km_signal",
    "is_male", "field_size", "disc_plat", "disc_trot", "disc_obstacle",
]


def parse_music_features(music: str, discipline: str) -> dict:
    chars = list(str(music or "").upper()[:8])
    positions = [int(c) for c in chars if c.isdigit() and c != "0"]
    dq_count = sum(1 for c in chars if c in {"0", "D"}) if discipline == "trot" else 0
    fall_count = sum(1 for c in chars if c in {"F", "T", "U", "P", "R"}) if discipline == "obstacle" else 0
    avg_pos = float(np.mean(positions)) if positions else 8.0
    recent = chars[:3]
    recent_nums = [int(c) for c in recent if c.isdigit() and c != "0"]
    rebound = int(len(positions) >= 2 and positions[0] <= 4 and any(v >= 7 for v in positions[1:4]))
    return {
        "music_avg_position": avg_pos,
        "music_dq_count": float(dq_count),
        "music_fall_count": float(fall_count),
        "music_recent_wins": float(sum(1 for v in recent_nums if v == 1)),
        "music_recent_top3": float(sum(1 for v in recent_nums if v <= 3)),
        "music_rebound": float(rebound),
    }


def parse_reduction_km(rk: str | None) -> float:
    if not rk:
        return 0.0
    import re
    raw = str(rk).replace("'", ".").replace("`", ".").replace('"', "").strip()
    m = re.search(r"(\d+)[.,](\d+)", raw)
    if not m:
        return 0.0
    minutes, frac = int(m.group(1)), m.group(2)
    total = minutes + (int(frac) / 1000 if len(frac) >= 3 else int(frac) / 60)
    if total <= 1.01: return 1.0
    if total <= 1.03: return 0.90
    if total <= 1.05: return 0.75
    if total <= 1.07: return 0.55
    if total <= 1.10: return 0.35
    if total <= 1.15: return 0.15
    return 0.05


def build_features(ctx: RaceContext) -> tuple[np.ndarray, list[dict]]:
    rows, feat_dicts = [], []
    for r in ctx.runners:
        music_f = parse_music_features(r.music, ctx.discipline)
        row = {
            **music_f,
            "age": float(r.age),
            "earnings_eur_log": float(np.log1p(r.earnings_eur)),
            "handicap_weight": float(r.handicap_weight or 0),
            "reduction_km_signal": parse_reduction_km(r.reduction_km),
            "is_male": float(1 if r.sex in {"M", "H"} else 0),
            "field_size": float(ctx.field_size),
            "disc_plat": float(ctx.discipline == "plat"),
            "disc_trot": float(ctx.discipline == "trot"),
            "disc_obstacle": float(ctx.discipline == "obstacle"),
        }
        rows.append([row[f] for f in FEATURE_NAMES])
        feat_dicts.append(row)

    return np.array(rows, dtype=np.float32), feat_dicts


@app.post("/score", response_model=AgentResponse)
def score(ctx: RaceContext) -> AgentResponse:
    t0 = time.perf_counter()

    X, feat_dicts = build_features(ctx)

    if MODEL is not None:
        raw_scores = MODEL.predict(X, raw_score=True)
    else:
        # Mock fallback: use music_avg_position as proxy
        raw_scores = np.array([-row["music_avg_position"] for row in feat_dicts], dtype=np.float32)

    warnings_list = []
    empty_music = [r.horse_name for r in ctx.runners if not r.music]
    if empty_music:
        warnings_list.append(f"musique vide: {', '.join(empty_music[:3])} — score baseline appliqué")

    signals = [
        AgentSignal(
            horse_id=runner.horse_id,
            score=float(score_val),
            confidence=0.8 if runner.music else 0.35,
            features_used=feat_dicts[i],
            sub_signals={"music": parse_music_features(runner.music, ctx.discipline)},
        )
        for i, (runner, score_val) in enumerate(zip(ctx.runners, raw_scores))
    ]

    return AgentResponse(
        agent_name="form_agent",
        model_version=MODEL_VERSION,
        git_sha=GIT_SHA,
        data_cutoff_at=datetime.now(timezone.utc),
        signals=signals,
        warnings=warnings_list,
        latency_ms=(time.perf_counter() - t0) * 1000,
    )


@app.get("/health")
def health():
    return {"status": "ok", "model_version": MODEL_VERSION, "model_loaded": MODEL is not None}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8001)))
