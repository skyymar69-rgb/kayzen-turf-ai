"""
Détection de steam (smart money entrant) et drift (défiance) sur les cotes PMU.
Steam sur outsider (rang 4-8) dans H-30min = signal très fort empiriquement.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def detect_market_signals(features_df: pd.DataFrame) -> pd.DataFrame:
    """
    Détecte steam et drift anormaux à partir des features de drift (drift_features.py).

    Colonnes d'entrée : tout ce que build_drift_features produit.
    Colonnes de sortie :
        steam_score         — amplitude du raccourcissement anormal
        drift_score         — amplitude de l'allongement anormal
        smart_money_signal  — steam sur outsider (rang 4-8) = signal exploitable
        late_acceleration   — mouvement anormal dans H-30min
        market_signal       — résumé textuel
    """
    df = features_df.copy()

    # Velocity 30min — distribution du champ comme référence
    v30 = df["velocity_30m"].fillna(0)
    sigma_field = max(float(v30.std()), 0.001)

    # Steam : log_odds chute (cote raccourcit) → cheval sous pression
    df["steam_score"] = np.where(
        v30 < -2 * sigma_field,
        np.abs(v30) / sigma_field,
        0.0,
    )

    # Drift : log_odds monte (cote s'allonge) → défiance marché
    df["drift_score"] = np.where(
        v30 > 2 * sigma_field,
        v30 / sigma_field,
        0.0,
    )

    # Smart money : steam sur zone outsider (rang 4-8 dans le champ)
    rank = df["log_odds_rank"].fillna(df["log_odds_rank"].median())
    is_outsider_zone = (rank >= 4) & (rank <= 8)
    df["smart_money_signal"] = df["steam_score"] * is_outsider_zone.astype(float)

    # Late acceleration : mouvement anormal dans H-30min
    mtu = df["minutes_to_off"].fillna(60)
    acc = df["acceleration"].fillna(0)
    df["late_acceleration"] = np.where(
        mtu <= 30,
        acc.abs() / sigma_field,
        0.0,
    )

    # Signal résumé
    def classify(row):
        if row["drift_score"] > 3.0:
            return "drift_red_flag"
        if row["smart_money_signal"] > 2.5:
            return "smart_money_steam"
        if row["steam_score"] > 3.0:
            return "steam_strong"
        if row["steam_score"] > 1.5:
            return "steam_moderate"
        if row["drift_score"] > 1.5:
            return "drift_moderate"
        if row["late_acceleration"] > 4.0:
            return "late_activity_unusual"
        return "neutral"

    df["market_signal"] = df.apply(classify, axis=1)

    return df[[
        "horse_id", "steam_score", "drift_score",
        "smart_money_signal", "late_acceleration", "market_signal",
    ]]


def steam_in_last_n_minutes(
    snapshots_df: pd.DataFrame,
    horse_id: str,
    n_minutes: int,
    decision_time: pd.Timestamp,
) -> float:
    """
    Calcule le steam d'un cheval précis sur les n_minutes précédant decision_time.
    Retourne la variation en % de la cote (négatif = raccourcissement).
    """
    snapshots_df = snapshots_df.copy()
    snapshots_df["observed_at"] = pd.to_datetime(snapshots_df["observed_at"], utc=True)
    horse = snapshots_df[
        (snapshots_df["horse_id"] == horse_id)
        & (snapshots_df["observed_at"] <= decision_time)
        & (snapshots_df["observed_at"] >= decision_time - pd.Timedelta(minutes=n_minutes))
    ].sort_values("observed_at")

    if len(horse) < 2:
        return 0.0
    return float((horse["odds"].iloc[-1] / horse["odds"].iloc[0]) - 1) * 100
