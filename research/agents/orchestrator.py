"""
PredictionOrchestrator — lance les 5 agents en parallèle et combine via meta-learner.
Latence end-to-end ≈ max(agents), pas leur somme.
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Optional

import httpx
import numpy as np

from contracts import AgentResponse, PredictionResult, HorsePredictionOut, RaceContext

log = logging.getLogger(__name__)

# Prélèvement PMU par type de pari
PMU_TAKEOUT = {
    "simple_gagnant": 0.165, "simple_place": 0.165,
    "couple": 0.215, "trio": 0.245,
    "quarte": 0.260, "quinte": 0.260,
}

AGENT_NAMES = ["form_agent", "connections_agent", "conditions_agent", "market_agent", "risk_agent"]
CRITICAL_AGENTS = {"form_agent", "conditions_agent"}


def softmax_safe(scores: np.ndarray) -> np.ndarray:
    s = scores - scores.max()
    e = np.exp(s)
    return e / e.sum()


def gumbel_noise(rng: np.random.Generator, n: int) -> np.ndarray:
    return -np.log(-np.log(rng.uniform(0, 1, n) + 1e-12))


def monte_carlo_topk(scores: np.ndarray, k: int, n_sim: int = 3000, seed: int = 0) -> np.ndarray:
    rng = np.random.default_rng(seed)
    n = len(scores)
    counts = np.zeros(n)
    for _ in range(n_sim):
        perturbed = scores + gumbel_noise(rng, n)
        counts[np.argsort(-perturbed)[:k]] += 1
    return counts / n_sim


def ev_pmu(p: float, odds: float, bet_type: str = "simple_gagnant") -> float:
    takeout = PMU_TAKEOUT.get(bet_type, 0.22)
    return p * odds * (1 - takeout) - 1


def kz_from_pl(p_win: float, p_top3: float, confidence: float) -> int:
    raw = p_win * 350 + p_top3 * 140 + confidence * 20
    return max(1, min(99, round(raw)))


class PredictionOrchestrator:
    def __init__(
        self,
        agent_endpoints: dict[str, str],
        meta_learner,
        timeout_s: float = 2.5,
    ):
        self.endpoints = agent_endpoints
        self.meta = meta_learner
        self.client = httpx.AsyncClient(timeout=timeout_s)

    async def _call_agent(self, name: str, ctx: RaceContext) -> Optional[AgentResponse]:
        url = f"{self.endpoints[name]}/score"
        try:
            resp = await self.client.post(url, json=ctx.model_dump(mode="json"))
            resp.raise_for_status()
            return AgentResponse.model_validate(resp.json())
        except Exception as exc:
            log.warning(f"agent {name} failed: {exc}")
            return None

    async def predict(self, ctx: RaceContext) -> PredictionResult:
        t0 = time.perf_counter()

        # Tous les agents en parallèle
        tasks = {name: asyncio.create_task(self._call_agent(name, ctx)) for name in self.endpoints}
        results: dict[str, Optional[AgentResponse]] = {name: await t for name, t in tasks.items()}

        # Vérification des agents critiques
        failed_critical = [n for n in CRITICAL_AGENTS if results.get(n) is None]
        if failed_critical:
            raise RuntimeError(f"Critical agents failed: {failed_critical} — refusing prediction")

        warnings: list[str] = []
        for name, resp in results.items():
            if resp is None:
                warnings.append(f"{name} indisponible — score imputé")
            elif resp.warnings:
                warnings.extend(f"[{name}] {w}" for w in resp.warnings)

        # Matrice de scores [n_horses, n_agents]
        n_horses = len(ctx.runners)
        agent_names = list(results.keys())
        n_agents = len(agent_names)
        stack = np.full((n_horses, n_agents), np.nan)
        confidence = np.zeros((n_horses, n_agents))

        horse_idx = {r.horse_id: i for i, r in enumerate(ctx.runners)}
        for j, name in enumerate(agent_names):
            resp = results[name]
            if resp is None:
                continue
            for sig in resp.signals:
                i = horse_idx.get(sig.horse_id)
                if i is not None:
                    stack[i, j] = sig.score
                    confidence[i, j] = sig.confidence

        # Imputation des agents down par médiane pondérée
        col_means = np.nanmean(stack, axis=0, keepdims=True)
        stack_imputed = np.where(np.isnan(stack), col_means, stack)

        # Meta-learner
        final_scores = self.meta.combine(stack_imputed, confidence, ctx)

        # Plackett-Luce probas cohérentes
        p_win = softmax_safe(final_scores)
        p_top3 = monte_carlo_topk(final_scores, k=3)
        p_top5 = monte_carlo_topk(final_scores, k=5)

        data_cutoff = min(
            (r.data_cutoff_at for r in results.values() if r is not None),
            default=datetime.now(timezone.utc),
        )

        horses_out = [
            HorsePredictionOut(
                horse_id=ctx.runners[i].horse_id,
                horse_name=ctx.runners[i].horse_name,
                p_win=round(float(p_win[i]), 4),
                p_top3=round(float(p_top3[i]), 4),
                p_top5=round(float(p_top5[i]), 4),
                kz_score=kz_from_pl(float(p_win[i]), float(p_top3[i]), float(confidence[i].mean())),
                market_edge_pct=round(ev_pmu(float(p_win[i]), ctx.runners[i].odds) * 100, 1),
                agent_breakdown={name: float(stack[i, j]) if not np.isnan(stack[i, j]) else None
                                 for j, name in enumerate(agent_names)},
            )
            for i in range(n_horses)
        ]

        log.info(f"predict race={ctx.race_id} latency={(time.perf_counter() - t0)*1000:.0f}ms")

        return PredictionResult(
            race_id=ctx.race_id,
            generated_at=datetime.now(timezone.utc),
            horses=horses_out,
            model_versions={name: (r.model_version if r else None) for name, r in results.items()},
            data_cutoff_at=data_cutoff,
            warnings=warnings,
        )

    async def predict_by_id(self, race_id: str) -> PredictionResult:
        raise NotImplementedError("Inject race_repository implementation")

    async def get_agent_signal(self, race_id: str, agent_name: str) -> dict:
        raise NotImplementedError("Inject race_repository implementation")

    async def aclose(self):
        await self.client.aclose()
