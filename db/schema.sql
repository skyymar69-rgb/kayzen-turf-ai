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
  reunion_number integer,
  course_number integer,
  source_country text,
  name text not null,
  racecourse_id uuid references racecourses(id),
  start_time text not null,
  discipline text not null check (discipline in ('Plat', 'Trot', 'Obstacle')),
  specialty text,
  distance text not null,
  going text,
  weather text,
  market_volatility numeric not null default 0,
  model_consensus numeric not null default 0,
  race_quality_score numeric not null default 0,
  betting_tier text not null check (betting_tier in ('Focus', 'Value', 'Avoid')),
  risk_level text not null check (risk_level in ('Prudent', 'Equilibre', 'Speculatif')),
  bet_types jsonb not null default '[]'::jsonb,
  data_cutoff_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table races add column if not exists reunion_number integer;
alter table races add column if not exists course_number integer;
alter table races add column if not exists source_country text;
alter table races add column if not exists bet_types jsonb not null default '[]'::jsonb;
alter table races add column if not exists specialty text;

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
  age integer,
  sex text,
  music text,
  earnings numeric,
  handicap_distance integer,
  reduction_km text,
  equipment text,
  silks_url text,
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

alter table entries add column if not exists age integer;
alter table entries add column if not exists sex text;
alter table entries add column if not exists music text;
alter table entries add column if not exists earnings numeric;
alter table entries add column if not exists handicap_distance integer;
alter table entries add column if not exists reduction_km text;
alter table entries add column if not exists equipment text;
alter table entries add column if not exists silks_url text;

-- Une cote absente est NULL. L'import y écrivait la cote juste du modèle
-- faute de rapport PMU : le site affichait alors « cote 8,82 » pour une course
-- dont le marché n'avait rien publié, et tous les partants ressortaient à la
-- même probabilité. Idempotent : sans effet si la contrainte est déjà levée.
alter table entries alter column odds drop not null;

-- Variables disponibles dans l'API PMU avant le départ, qui n'étaient pas
-- capturées. Aucune n'alimente encore le modèle : elles sont stockées pour être
-- évaluées par scripts/evaluate-features.mjs une fois l'historique constitué.
--
--   weight       poids porté (handicapPoids), en décigrammes — 580 = 58,0 kg.
--                Variable centrale du Plat et de l'Obstacle, absente jusqu'ici.
--   draw         place à la corde (placeCorde).
--   shoeing      déferrage (deferre) — signal majeur du Trot. Il arrivait bien
--                de l'API mais `equipment` le remplaçait par les œillères, qui
--                sont toujours renseignées : il n'était donc jamais stocké.
--   speed_figure réduction kilométrique RELEVÉE AVANT LA COURSE, puis gelée.
--                Le champ `reduction_km` existant est inutilisable pour prédire :
--                après l'arrivée, l'API y renvoie le chrono réalisé dans la
--                course. Le meilleur `reduction_km` d'une course gagne dans
--                78,4 % des cas — ce n'est pas une performance de modèle, c'est
--                la lecture du résultat.
alter table entries add column if not exists weight numeric;
alter table entries add column if not exists draw integer;
alter table entries add column if not exists shoeing text;
alter table entries add column if not exists speed_figure numeric;

-- Répartition réelle des enjeux, relevée sur l'endpoint `citations` de l'API PMU
-- (part du pool misée sur chaque cheval, en %). Le pool gagnant recopie ce que
-- la cote dit déjà. Les deux autres portent une information que nous n'avons pas :
--
--   pool_place  part du pool PLACÉ. C'est une estimation du Top 3 OBSERVÉE, là
--               où nous la DÉDUISONS aujourd'hui des probabilités de victoire par
--               Plackett-Luce — modèle mesuré comme trop optimiste sur les places
--               (plafond simulé 2,88 contre 2,52 réellement atteints par le marché).
--   pool_quinte part du pool QUINTÉ sur la première position.
--
-- Écart moyen |placé − gagnant| mesuré sur 85 partants : 1,10 point, jusqu'à 5,92.
-- Ce n'est pas du bruit. Les pools ne se remplissent que le jour de la course :
-- ils sont relevés par le rafraîchissement, donc toujours avant le départ.
alter table entries add column if not exists pool_win numeric;
alter table entries add column if not exists pool_place numeric;
alter table entries add column if not exists pool_quinte numeric;

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
  created_at timestamptz not null default now(),
  unique (race_id, horse_id)
);

create table if not exists model_calibrations (
  id uuid primary key default gen_random_uuid(),
  segment text not null,
  model_version text not null,
  weights jsonb not null,
  metrics jsonb not null default '{}'::jsonb,
  learned_from_races integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists race_feedback (
  id uuid primary key default gen_random_uuid(),
  race_id text not null references races(id) on delete cascade,
  segment text not null,
  predicted_top5 integer[] not null default '{}',
  actual_top5 integer[] not null default '{}',
  winner_hit boolean not null default false,
  top3_hits integer not null default 0,
  top5_hits integer not null default 0,
  average_position_error numeric,
  verdict text not null,
  lessons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (race_id, segment)
);

create index if not exists races_race_date_idx on races (race_date);
create index if not exists races_relative_day_idx on races (relative_day);
create index if not exists races_program_order_idx on races (race_date, reunion_number, course_number);
create index if not exists entries_race_id_idx on entries (race_id);
create index if not exists odds_snapshots_race_horse_observed_idx on odds_snapshots (race_id, horse_id, observed_at desc);
create index if not exists prediction_runs_generated_at_idx on prediction_runs (generated_at desc);
create index if not exists predictions_race_id_idx on predictions (race_id);
create index if not exists predictions_run_idx on predictions (prediction_run_id);
create unique index if not exists value_bets_race_horse_unique_idx on value_bets (race_id, horse_id);
create index if not exists model_calibrations_active_idx on model_calibrations (segment, active, created_at desc);

-- Deux index strictement redondants : chacun duplique le préfixe d'une contrainte
-- unique déjà présente, et pg_stat_user_indexes les donne à zéro lecture depuis
-- la création de la base. `compact-storage.mjs` supprimait déjà le premier — mais
-- ce fichier le recréait au passage suivant, trois fois par jour. On coupe la
-- boucle ici, à la source.
drop index if exists value_bets_race_id_idx;
drop index if exists race_feedback_race_id_idx;

-- Garde-fou : sans limite, une requête partie en vrille immobilise une connexion
-- indéfiniment — ce qui compte sur une base serverless où les connexions sont la
-- ressource rare. 300 s laisse largement passer la plus lourde des requêtes de
-- lecture du site (4 s mesurées). Les purges de `compact-storage.mjs`, seules
-- opérations légitimement longues, relèvent la limite pour leur propre session.
alter role current_user set statement_timeout = '300s';

-- ─────────────────────────────────────────────────────────────────────────────
-- Demandes d'exercice des droits RGPD (art. 15 à 21 du règlement 2016/679).
--
-- Le formulaire de la page /confidentialite n'envoyait la demande nulle part :
-- il affichait « branchement email/API à finaliser » et jetait la saisie. Une
-- demande d'accès ou d'effacement doit être tracée et traitée sous un mois
-- (art. 12.3) ; sans registre, aucun délai n'est opposable ni démontrable.
--
-- Minimisation (art. 5.1.c) : on ne stocke que l'email de contact, la nature de
-- la demande et son message. Aucune adresse IP, aucun agent utilisateur.
-- La purge des demandes closes est décrite dans docs/DATA_RETENTION_POLICY.md.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists privacy_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  email text not null,
  request_type text not null check (
    request_type in ('access', 'rectification', 'erasure', 'opposition', 'limitation', 'portability')
  ),
  message text not null,
  status text not null default 'received' check (status in ('received', 'in_progress', 'closed')),
  created_at timestamptz not null default now(),
  handled_at timestamptz
);

create index if not exists privacy_requests_status_idx on privacy_requests (status, created_at);
