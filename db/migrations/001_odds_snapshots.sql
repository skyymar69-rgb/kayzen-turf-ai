-- Migration 001 — Snapshots de cotes PMU pour modèle de drift
-- Appliquer avec : psql $DATABASE_URL -f db/migrations/001_odds_snapshots.sql

CREATE TABLE IF NOT EXISTS odds_snapshots (
    id              BIGSERIAL PRIMARY KEY,
    race_id         TEXT NOT NULL,
    horse_id        TEXT NOT NULL,
    odds            NUMERIC(8, 2) NOT NULL,
    observed_at     TIMESTAMPTZ NOT NULL,
    minutes_to_off  INTEGER,
    pool_eur        NUMERIC(14, 2),  -- masse totale si disponible
    bet_type        TEXT NOT NULL DEFAULT 'simple_gagnant',
    UNIQUE (race_id, horse_id, observed_at, bet_type)
);

CREATE INDEX IF NOT EXISTS idx_odds_race_time   ON odds_snapshots(race_id, observed_at);
CREATE INDEX IF NOT EXISTS idx_odds_horse_time  ON odds_snapshots(horse_id, observed_at);
CREATE INDEX IF NOT EXISTS idx_odds_race_type   ON odds_snapshots(race_id, bet_type, observed_at);

-- Table de log des prédictions (nécessaire pour champion-challenger et CLV tracking)
CREATE TABLE IF NOT EXISTS prediction_logs (
    id              BIGSERIAL PRIMARY KEY,
    agent_name      TEXT NOT NULL,
    race_id         TEXT NOT NULL,
    race_date       DATE NOT NULL,
    horse_id        TEXT NOT NULL,
    predicted_p_win NUMERIC(6, 4),
    actual_winner   BOOLEAN,
    log_loss_per_race NUMERIC(8, 4),
    odds_taken      NUMERIC(8, 2),
    odds_closing    NUMERIC(8, 2),
    model_version   TEXT NOT NULL,
    git_sha         TEXT,
    role            TEXT NOT NULL CHECK (role IN ('champion', 'challenger')),
    discipline      TEXT CHECK (discipline IN ('plat', 'trot', 'obstacle')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pred_logs_agent_date  ON prediction_logs(agent_name, race_date);
CREATE INDEX IF NOT EXISTS idx_pred_logs_role        ON prediction_logs(role, agent_name, race_date);
