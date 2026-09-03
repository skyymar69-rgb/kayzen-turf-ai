"""
Filtre de décision pari — intègre drift, takeout PMU réel et CLV attendu.
Remplace le marketEdge naïf par un edge corrigé pari-mutuel.
"""
from __future__ import annotations

from dataclasses import dataclass, field


# Prélèvements PMU officiels (source : règlement PMU)
TAKEOUT: dict[str, float] = {
    "simple_gagnant": 0.135,
    "simple_place": 0.165,
    "couple_gagnant": 0.225,
    "couple_place": 0.235,
    "couple_ordre": 0.235,
    "deux_sur_quatre": 0.225,
    "trio": 0.255,
    "trio_ordre": 0.255,
    "tierce": 0.225,
    "multi": 0.270,
    "super_quatre": 0.260,
    "quarte_plus": 0.255,
    "quinte_plus": 0.295,
    "pick5": 0.280,
    "tic_trois": 0.255,
}


@dataclass
class BetDecision:
    horse_id: str
    bet: bool
    reason: str
    edge_naive: float          # odds_now × p − 1  (calcul actuel de l'app)
    edge_adjusted: float       # odds_close_pred × (1 − takeout) × p − 1
    expected_clv: float        # odds_now / odds_close_pred − 1
    smart_money_flag: bool
    signals: dict = field(default_factory=dict)


def decide_bet(
    horse_id: str,
    p_calibrated: float,        # probabilité Plackett-Luce calibrée [0-1]
    odds_now: float,            # cote snapshot courant
    predicted_odds_close: float,
    drift_signals: dict,
    bet_type: str = "simple_gagnant",
    min_edge: float = 0.05,
    min_clv: float = 0.02,
) -> BetDecision:
    """
    Prend une décision de paris en corrigeant l'edge naïf par le drift et le takeout PMU.

    Étapes :
    1. Edge naïf  : ce que l'app calcule aujourd'hui (ignore takeout + drift)
    2. Edge ajusté : paiement attendu réel après prélèvement
    3. CLV attendu : mesure si l'on bat la ligne de fermeture
    4. Filtres cumulatifs + override drift

    Critères cumulatifs :
      - edge_adjusted ≥ min_edge  (défaut : +5%)
      - expected_clv ≥ min_clv   (défaut : +2%)
      - drift_score < 3.0        (sinon : abstention)
    """
    takeout = TAKEOUT.get(bet_type, 0.22)

    # Edge naïf (calcul actuel)
    edge_naive = p_calibrated * odds_now - 1

    # Paiement effectif attendu après takeout sur cote prévue à la fermeture
    effective_payout = predicted_odds_close * (1.0 - takeout)
    edge_adjusted = p_calibrated * effective_payout - 1

    # CLV attendu
    expected_clv = (odds_now / max(predicted_odds_close, 0.01)) - 1

    smart_money = float(drift_signals.get("smart_money_signal", 0.0)) > 1.5
    drift_red_flag = float(drift_signals.get("drift_score", 0.0)) > 3.0

    signals = {
        "edge_naive": round(edge_naive, 4),
        "edge_adjusted": round(edge_adjusted, 4),
        "expected_clv": round(expected_clv, 4),
        "effective_payout": round(effective_payout, 3),
        "takeout_applied": takeout,
        "predicted_odds_close": round(predicted_odds_close, 2),
        **drift_signals,
    }

    # Override drift défavorable sur favori
    if drift_red_flag:
        return BetDecision(horse_id, False, "drift_red_flag",
                           edge_naive, edge_adjusted, expected_clv, smart_money, signals)

    if edge_adjusted < min_edge:
        return BetDecision(horse_id, False,
                           f"edge_adjusted={edge_adjusted:.3f}<{min_edge}",
                           edge_naive, edge_adjusted, expected_clv, smart_money, signals)

    if expected_clv < min_clv:
        return BetDecision(horse_id, False,
                           f"expected_clv={expected_clv:.3f}<{min_clv}",
                           edge_naive, edge_adjusted, expected_clv, smart_money, signals)

    return BetDecision(horse_id, True, "all_filters_pass",
                       edge_naive, edge_adjusted, expected_clv, smart_money, signals)


def effective_odds_after_takeout(odds: float, bet_type: str = "simple_gagnant") -> float:
    """Paiement net après prélèvement PMU — utilisable dans Kelly et EV."""
    return odds * (1.0 - TAKEOUT.get(bet_type, 0.22))


def kelly_fraction_pmu(
    p: float,
    odds: float,
    bet_type: str = "simple_gagnant",
    fraction: float = 0.25,
    max_stake_fraction: float = 0.05,
) -> float:
    """Kelly fractionnel avec takeout intégré."""
    net_odds = effective_odds_after_takeout(odds, bet_type) - 1
    if net_odds <= 0:
        return 0.0
    kelly_full = (p * (net_odds + 1) - 1) / net_odds
    return max(0.0, min(kelly_full * fraction, max_stake_fraction))
