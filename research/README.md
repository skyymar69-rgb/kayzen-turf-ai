# research/ — code exploratoire, non déployé

Ce dossier regroupe le code Python d'exploration (agents, pace, portfolio, drift, modèles LightGBM/PyTorch, `scripts/promote_challenger.py`, `deploy/agents.yaml`, `requirements-ml.txt`) déplacé hors de la racine du dépôt le 04/09/2026.

Ce qu'il faut savoir avant d'y toucher :

- **Il n'est pas déployé** : rien sur Vercel ni dans les workflows GitHub Actions ne l'exécute. Le site ne lit que Postgres via `src/lib/`, alimenté par les scripts Node de `scripts/`.
- **Il n'est pas maintenu** : aucun test, aucune CI, dépendances jamais mises à jour.
- **Il n'est pas branché au site** : ses tables (`prediction_logs`, colonnes `bet_type`/`pool_eur` de `odds_snapshots`) n'existent pas dans `db/schema.sql`.
- **Il référence des fichiers de modèles absents** (`models/drift_lgbm.pkl`, `pace/pace_adj_calibrated.npy`…) : il ne peut pas tourner tel quel.
- **Ne jamais l'exécuter contre la base de production.** Plusieurs modules chargent des modèles par `pickle.load` (exécution de code arbitraire si le fichier est altéré), et plusieurs CLI (`--db-url`) écrivent dans la base passée en argument sans garde-fou.

Le moteur réellement en production est décrit dans `docs/algorithmes-documentation.md` ; les bancs d'évaluation à jour sont `scripts/evaluate-*.mjs`.
