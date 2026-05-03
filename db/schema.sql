create extension if not exists pgcrypto;

create table if not exists racecourses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  country text not null default 'FR',
  surface text,
  created_at timestamptz not null default now()
);

create table if not exists races (
  id text primary key,
  race_date date not null,
  relative_day text check (relative_day in ('yesterday', 'today', 'tomorrow')),
  name text not null,
  racecourse_id uuid references racecourses(id),
  start_time text not null,
  discipline text not null check (discipline in ('Plat', 'Trot', 'Obstacle')),
  distance text not null,
  going text,
  weather text,
  market_volatility numeric not null default 0,
  model_consensus numeric not null default 0,
  race_quality_score numeric not null default 0,
  betting_tier text not null check (betting_tier in ('Focus', 'Value', 'Avoid')),
  risk_level text not null check (risk_level in ('Prudent', 'Equilibre', 'Speculatif')),
  data_cutoff_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists horses (
  id text primary key,
  name text not null,
  age integer,
  created_at timestamptz not null default now()
);

create table if not exists jockeys (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists trainers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists entries (
  id text primary key,
  race_id text not null references races(id) on delete cascade,
  horse_id text not null references horses(id),
  number integer not null,
  jockey_id uuid references jockeys(id),
  trainer_id uuid references trainers(id),
  odds numeric not null,
  fair_odds numeric not null,
  market_edge numeric not null,
  win_probability numeric not null,
  top3_probability numeric not null,
  top5_probability numeric not null,
  kz_score numeric not null,
  value_index numeric not null,
  confidence text not null check (confidence in ('Faible', 'Moyenne', 'Forte')),
  factors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (race_id, number)
);

create table if not exists odds_snapshots (
  id uuid primary key default gen_random_uuid(),
  race_id text not null references races(id) on delete cascade,
  horse_id text not null references horses(id),
  odds numeric not null,
  source text not null,
  observed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists results (
  id uuid primary key default gen_random_uuid(),
  race_id text not null references races(id) on delete cascade,
  horse_id text not null references horses(id),
  finish_position integer,
  won boolean,
  created_at timestamptz not null default now(),
  unique (race_id, horse_id)
);

create table if not exists prediction_runs (
  id uuid primary key default gen_random_uuid(),
  model_version text not null,
  data_cutoff_at timestamptz not null,
  generated_at timestamptz not null default now(),
  model_card jsonb not null default '{}'::jsonb
);

create table if not exists predictions (
  id uuid primary key default gen_random_uuid(),
  prediction_run_id uuid references prediction_runs(id),
  race_id text not null references races(id) on delete cascade,
  horse_id text not null references horses(id),
  win_probability numeric not null,
  top3_probability numeric not null,
  top5_probability numeric not null,
  kz_score numeric not null,
  confidence text not null,
  explanation jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists value_bets (
  id uuid primary key default gen_random_uuid(),
  race_id text not null references races(id) on delete cascade,
  horse_id text not null references horses(id),
  market_odds numeric not null,
  fair_odds numeric not null,
  edge numeric not null,
  confidence text not null,
  created_at timestamptz not null default now()
);

create index if not exists races_race_date_idx on races (race_date);
create index if not exists races_relative_day_idx on races (relative_day);
create index if not exists entries_race_id_idx on entries (race_id);
create index if not exists predictions_race_id_idx on predictions (race_id);
create index if not exists value_bets_race_id_idx on value_bets (race_id);
