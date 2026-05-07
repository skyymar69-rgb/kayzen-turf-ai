"""
Serveur MCP B2B — expose predict_race, value_bets_today, agent_signals, simulate_bet.
Phase 5 de la roadmap. Connecte n'importe quel LLM à l'orchestrateur via le protocole MCP.
"""
from __future__ import annotations

import json
import asyncio
import os
from typing import Any

from mcp.server import Server
from mcp.types import Tool, TextContent

# Injecté au démarrage (lazy import pour éviter circular deps)
_orchestrator = None
_value_service = None
_bet_simulator = None

PMU_TAKEOUT = {
    "simple_gagnant": 0.165, "simple_place": 0.165,
    "couple_gagnant": 0.215, "couple_place": 0.215, "couple_ordre": 0.215,
    "trio": 0.245, "trio_ordre": 0.245, "tierce": 0.245,
    "multi": 0.270, "super_quatre": 0.270,
    "quarte_plus": 0.260, "quinte_plus": 0.260, "pick5": 0.260, "tic_trois": 0.245,
}

server = Server("kayzen-turf-ai")


@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="predict_race",
            description=(
                "Renvoie les probabilités calibrées Plackett-Luce (p_win, p_top3, p_top5), "
                "KZ Score et breakdown par agent pour une course donnée."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "race_id": {
                        "type": "string",
                        "description": "Identifiant de la course (format YYYY-MM-DD-RxCy ou UUID)",
                    },
                },
                "required": ["race_id"],
            },
        ),
        Tool(
            name="value_bets_today",
            description=(
                "Liste les paris à edge positif pour la journée en cours, "
                "filtrés par confidence minimum et discipline."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "date": {"type": "string", "format": "date"},
                    "min_edge": {"type": "number", "default": 0.05,
                                 "description": "Edge minimum EV pari-mutuel (0.05 = +5%)"},
                    "min_confidence": {"type": "number", "default": 0.6},
                    "disciplines": {
                        "type": "array",
                        "items": {"type": "string", "enum": ["plat", "trot", "obstacle"]},
                    },
                },
            },
        ),
        Tool(
            name="agent_signals",
            description=(
                "Renvoie le signal brut d'un agent spécifique pour une course "
                "(audit, debug, intégration B2B granulaire)."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "race_id": {"type": "string"},
                    "agent_name": {
                        "type": "string",
                        "enum": ["form_agent", "connections_agent", "conditions_agent",
                                 "market_agent", "risk_agent"],
                    },
                },
                "required": ["race_id", "agent_name"],
            },
        ),
        Tool(
            name="simulate_bet",
            description=(
                "Simule un pari : sizing Kelly fractionnel avec drawdown adjustment, "
                "EV pari-mutuel avec prélèvement PMU, CLV attendu."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "race_id": {"type": "string"},
                    "horse_id": {"type": "string"},
                    "bet_type": {
                        "type": "string",
                        "enum": list(PMU_TAKEOUT.keys()),
                        "default": "simple_gagnant",
                    },
                    "stake_eur": {"type": "number"},
                    "bankroll_eur": {"type": "number"},
                    "drawdown_pct": {"type": "number", "default": 0},
                    "kelly_fraction": {"type": "number", "default": 0.25},
                    "profile": {
                        "type": "string",
                        "enum": ["prudent", "balanced", "aggressive"],
                        "default": "balanced",
                    },
                },
                "required": ["race_id", "horse_id", "stake_eur", "bankroll_eur"],
            },
        ),
        Tool(
            name="closing_line_value",
            description=(
                "Calcule le CLV (Closing Line Value) pour évaluer si la cote prise "
                "était supérieure à la cote finale de marché. "
                "CLV > 0 = vous avez battu la ligne — indicateur principal de skill."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "odds_taken": {"type": "number", "description": "Cote au moment du pari"},
                    "odds_closing": {"type": "number", "description": "Cote finale avant départ"},
                },
                "required": ["odds_taken", "odds_closing"],
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    try:
        result = await _dispatch(name, arguments)
    except NotImplementedError as e:
        result = {"error": str(e), "note": "Service not wired — inject orchestrator/simulator at startup"}
    except Exception as e:
        result = {"error": str(e)}

    return [TextContent(type="text", text=json.dumps(result, default=str, indent=2))]


async def _dispatch(name: str, args: dict) -> Any:
    if name == "predict_race":
        if _orchestrator is None:
            raise NotImplementedError("orchestrator not wired")
        return (await _orchestrator.predict_by_id(args["race_id"])).model_dump()

    if name == "value_bets_today":
        if _value_service is None:
            raise NotImplementedError("value_service not wired")
        return await _value_service.scan(**args)

    if name == "agent_signals":
        if _orchestrator is None:
            raise NotImplementedError("orchestrator not wired")
        return await _orchestrator.get_agent_signal(args["race_id"], args["agent_name"])

    if name == "simulate_bet":
        if _bet_simulator is None:
            raise NotImplementedError("bet_simulator not wired")
        return _bet_simulator.simulate(**args)

    if name == "closing_line_value":
        odds_taken = float(args["odds_taken"])
        odds_closing = float(args["odds_closing"])
        if odds_closing <= 0:
            return {"error": "odds_closing must be > 0"}
        clv = (odds_taken / odds_closing - 1) * 100
        return {
            "odds_taken": odds_taken,
            "odds_closing": odds_closing,
            "clv_pct": round(clv, 2),
            "interpretation": (
                "Vous avez battu la ligne de fermeture — signal de skill long-terme" if clv > 0
                else "Cote inférieure à la fermeture — la valeur était ailleurs"
            ),
        }

    raise ValueError(f"Unknown tool: {name}")


def wire(orchestrator=None, value_service=None, bet_simulator=None):
    """Injecte les dépendances avant de démarrer le serveur MCP."""
    global _orchestrator, _value_service, _bet_simulator
    _orchestrator = orchestrator
    _value_service = value_service
    _bet_simulator = bet_simulator


async def run():
    from mcp.server.stdio import stdio_server
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(run())
