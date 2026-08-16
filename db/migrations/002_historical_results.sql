-- Archive historique des arrivées (source : open-pmu-api, licence MIT).
--
-- Table volontairement séparée des tables de production (races, entries,
-- results) : les identifiants de cette archive ne correspondent à rien chez
-- nous, et il s'agit d'un corpus d'entraînement, pas de données servies aux
-- utilisateurs. Aucune jointure avec la production, donc aucun risque
-- d'altérer l'affichage si la source se révèle imparfaite.
--
-- Portée : chaque ligne est un cheval classé dans une course passée, avec sa
-- cote finale et sa position. C'est le couple (cote, position) qui permet de
-- mesurer la calibration du modèle sur de l'historique réel.
--
-- Limite connue : la source ne détaille que les chevaux figurant à l'arrivée
-- publiée, pas le peloton complet. On dispose donc des placés, pas des
-- non-placés — suffisant pour calibrer, insuffisant pour reconstituer les
-- probabilités de tout un champ.

create table if not exists historical_results (
  id                text primary key,
  race_date         date        not null,
  program_code      text,
  racecourse        text,
  race_name         text,
  discipline        text,
  distance          integer,
  prize             integer,
  starters          integer,
  finish_position   integer     not null,
  horse_name        text        not null,
  sex               text,
  birth_year        integer,
  jockey            text,
  trainer           text,
  music             text,
  final_odds        numeric,
  earnings          numeric,
  draw              integer,
  source            text        not null default 'open-pmu-api',
  imported_at       timestamptz not null default now()
);

create index if not exists historical_results_date_idx    on historical_results (race_date);
create index if not exists historical_results_horse_idx   on historical_results (horse_name);
create index if not exists historical_results_odds_idx    on historical_results (final_odds) where final_odds is not null;

-- Suit l'avancement du backfill pour qu'il soit reprenable : une journée déjà
-- traitée n'est pas re-téléchargée, et une journée sans course est mémorisée
-- comme telle plutôt que retentée indéfiniment.
create table if not exists historical_backfill_log (
  race_date     date primary key,
  races_found   integer     not null default 0,
  rows_inserted integer     not null default 0,
  fetched_at    timestamptz not null default now()
);
