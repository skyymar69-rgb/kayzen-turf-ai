"""
Feature engineering pour le modèle de drift de cote PMU.
Anti-leakage strict : aucune feature postérieure à decision_time.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

DRIFT_FEATURES = [
    "log_odds_now", "minutes_to_off", "n_snapshots",
    "delta_log_odds_15m", "delta_log_odds_30m", "delta_log_odds_60m",
    "delta_log_odds_180m", "delta_log_odds_360m",
    "velocity_15m", "velocity_30m", "velocity_60m", "velocity_180m", "velocity_360m",
    "acceleration", "volatility",
    "log_odds_min_field", "log_odds_rank", "pool_share",
]

WINDOW_MINUTES = [15, 30, 60, 180, 360]


def build_drift_features(
    snapshots_df: pd.DataFrame,
    decision_time: pd.Timestamp,
) -> pd.DataFrame:
    """
    Construit les features de drift à l'instant decision_time.
    Anti-leakage : seuls les snapshots observed_at <= decision_time sont utilisés.

    snapshots_df colonnes attendues :
        race_id, horse_id, odds, observed_at, minutes_to_off, pool_eur
    """
    snapshots_df = snapshots_df.copy()
    snapshots_df["observed_at"] = pd.to_datetime(snapshots_df["observed_at"], utc=True)

    # Filtrage strict anti-leakage
    df = snapshots_df[snapshots_df["observed_at"] <= decision_time].copy()
    if df.empty:
        return pd.DataFrame(columns=["horse_id"] + DRIFT_FEATURES)

    df["log_odds"] = np.log(df["odds"].clip(lower=1.001))
    df = df.sort_values(["horse_id", "observed_at"])

    out = []
    for horse_id, g in df.groupby("horse_id"):
        last = g.iloc[-1]
        feats: dict = {
            "horse_id": horse_id,
            "log_odds_now": float(last["log_odds"]),
            "minutes_to_off": int(last["minutes_to_off"]) if pd.notna(last["minutes_to_off"]) else 0,
            "n_snapshots": len(g),
        }

        # Variations et velocités sur fenêtres glissantes
        for w in WINDOW_MINUTES:
            cutoff = decision_time - pd.Timedelta(minutes=w)
            past = g[g["observed_at"] >= cutoff]
            if len(past) >= 2:
                delta = float(past["log_odds"].iloc[-1] - past["log_odds"].iloc[0])
                feats[f"delta_log_odds_{w}m"] = delta
                feats[f"velocity_{w}m"] = delta / w
            else:
                feats[f"delta_log_odds_{w}m"] = 0.0
                feats[f"velocity_{w}m"] = 0.0

        # Accélération : velocity 15m vs velocity 60m
        feats["acceleration"] = feats["velocity_15m"] - feats["velocity_60m"]

        # Volatilité intra-cheval
        diffs = g["log_odds"].diff().dropna()
        feats["volatility"] = float(diffs.std()) if len(diffs) > 2 else 0.0

        # Contexte champ (position relative au dernier snapshot commun)
        last_common = df.groupby("horse_id")["observed_at"].max().min()
        field_at_last = df[df["observed_at"] == last_common]
        if len(field_at_last) < 2:
            field_at_last = df.groupby("horse_id").last()

        log_odds_field = field_at_last["log_odds"] if "log_odds" in field_at_last.columns else df.groupby("horse_id")["log_odds"].last()
        feats["log_odds_min_field"] = float(log_odds_field.min())
        sorted_field = log_odds_field.sort_values()
        rank = (sorted_field < feats["log_odds_now"]).sum() + 1
        feats["log_odds_rank"] = float(rank)

        # Part de pool implicite : 1/odds normalisée
        inv_odds = 1.0 / df.groupby("horse_id")["odds"].last()
        pool_share = (1.0 / last["odds"]) / inv_odds.sum()
        feats["pool_share"] = float(pool_share)

        out.append(feats)

    return pd.DataFrame(out)


def add_target(features_df: pd.DataFrame, closing_df: pd.DataFrame) -> pd.DataFrame:
    """
    Joint les cotes de fermeture pour créer la variable cible log(odds_close).
    closing_df : {'horse_id': str, 'odds_close': float}
    """
    return features_df.merge(
        closing_df[["horse_id", "odds_close"]].assign(log_odds_close=lambda x: np.log(x["odds_close"])),
        on="horse_id",
        how="left",
    )
