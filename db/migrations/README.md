Toute modification de schéma se fait dans `db/schema.sql` (instructions idempotentes : `create … if not exists`, `alter table … add column if not exists`), appliqué par `scripts/apply-schema.mjs` (`npm run db:schema`) à chaque import.
Ce dossier ne contient pas de migrations actives : `_archive/` garde d'anciens fichiers pour mémoire, à ne pas appliquer.
