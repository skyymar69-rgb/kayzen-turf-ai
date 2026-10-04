# Journal des modifications

Toutes les évolutions notables de Kayzen Turf sont consignées ici.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Le
projet n'a pas de numéros de version publiés : les entrées sont datées par mise
en ligne (déploiement continu depuis `main`). La version publique, limitée à ce
qu'un visiteur peut constater, vit dans `src/lib/changelog.ts` et s'affiche sur
`/nouveautes` ; les deux sont mises à jour ensemble.

## [Non publié]

### Ajouté
- /pronostics : navigation latérale par réunion, filtres, recherche, tri, vue compacte, sélecteur de jour, raccourcis clavier (`src/components/pronostics/`, `src/lib/pronostics-filters.ts`).
- /direct : courses des 30 prochaines minutes (`src/lib/direct.ts`).
- Page course : sommaire, navigation entre courses, comparateur, graphique de toutes les cotes, nuage IA × marché, différences depuis la dernière visite, lexique au survol, partage du ticket en image, image Open Graph par course, cartes mobiles, glissement entre courses, éclair des cotes, comparaison H-60 → départ.
- Accueil découpé en `src/components/home/` et `src/lib/home/` : ligne du temps, chevaux suivis, résumé du jour, bilan d'hier, aperçu au survol, blocs personnalisables.
- Alertes push : smart money, délaissé, arrivée (`src/lib/push/market-alerts.ts`) ; historique `/alertes` ; nouveaux motifs dans `push_deliveries`.
- Backtest : série quotidienne par signal, signaux placés de la confrontation, contrôle « argent sortant » ; `npm run model:confrontation`.
- Export CSV `/api/races/[id]/historique.csv`.
- PWA : service worker réseau d'abord avec copies hors ligne, invitation à l'installation, barre de navigation mobile.
- Workflow Lighthouse (seuils en avertissement).
- Page publique « État du service » (`/etat`) : âge des dernières cotes, dernier import du programme, couverture des cotes sur les courses du jour, dernier rapport de suivi de performance ; état « mode démonstration » explicite sans base.
- Page publique « Nouveautés » (`/nouveautes`), alimentée par `src/lib/changelog.ts`.
- Tests de bout en bout Playwright (`npm run test:e2e`, dossier `e2e/`) avec audit d'accessibilité axe-core sur l'accueil, une page course, `/pronostics` et `/methode` ; tâche CI `e2e` distincte.
- Couverture des tests unitaires (`npm run test:coverage`) sur `src/lib`, cible 80 %, non bloquante.
- Remontée structurée des erreurs serveur (`src/instrumentation.ts`, `onRequestError`) : une ligne JSON sans chaîne de requête ni en-têtes.
- `.env.example` documentant chaque variable d'environnement.
- Tests unitaires de `src/lib/rate-limit.ts`.

## 2026-10-04

### Ajouté
- Confrontation IA × marché et signaux d'argent sur la page course (retour client).

### Modifié
- Fondations partagées : état de course (`src/lib/race-status.ts`), badges de paris sur variables de thème.

## 2026-10-03

### Ajouté
- Le site devient Kayzen Turf (le nom PronoTurf était déjà pris).
- Analyse IA de dernière minute relançable sur chaque course, avec le détail des changements.
- Classement MVT et argent ; signal MVT mesuré au backtest.
- Alertes push sur les chevaux suivis, sans compte.

### Modifié
- Site 100 % gratuit.

### Corrigé
- Boucle de rafraîchissement live continue ; alerte de fraîcheur sur les données de la veille.
- Audit complet : bugs, visuel, accessibilité, sécurité.

## 2026-10-02

### Ajouté
- Fondations données : boucle live, parts d'enjeux historisées, pronostics gelés (H-60, H-15, H-2), rapports officiels PMU.
- IA sans cote (modèle fondamental), profils mesurés, page course refondue, suivi de performance public.
- Chevaux suivis et alertes de départ, tests de stratégie, documentation.

### Corrigé
- Rapports officiels des réunions régionales, publiés hors audience nationale.
- Page Tarifs : deux affirmations fausses remplacées par ce qui existe.
- CI suivi de performance : rattrapage des rapports borné à 400 courses par passage.

## 2026-09-04

### Corrigé
- Une cote absente n'est plus fabriquée, et le site le dit.
- Audit complet : modèle débranché, pipeline destructif, sécurité, interface.

## 2026-08-30

### Ajouté
- Rafraîchissement horaire des cotes avant le départ ; cotes plus fraîches, non-partants retirés.
- Bancs de mesure : fraîcheur des cotes, confrontation des Quintés, poids du modèle par taille de peloton, variables d'avant-course.
- Diagnostic de santé de la base, en lecture seule.
- La sélection passe de 6 à 8 chevaux.

### Corrigé
- L'apprentissage se validait sur les courses qui l'avaient réglé.
- Import PMU : le journal réécrivait 12 000 courses à chaque passage ; l'apprentissage dépassait le timeout.

## 2026-08-16

### Ajouté
- Banc de mesure du pouvoir prédictif, modèle contre marché.
- Récupération de l'historique depuis l'API officielle PMU.

### Corrigé
- Poids du modèle ramené à l'optimum mesuré (0,30 → 0,10).
- Probabilités cohérentes, sélection unique, confiance des tickets en vraie probabilité.
- Arrivée provisoire remplacée par l'arrivée définitive.
- Indexation et TTFB : robots, sitemap, rendu incrémental ; calcul serveur rapatrié en Europe (fra1).
- Import PMU bloqué : la base Neon saturait de doublons.

### Sécurité
- Audit production : sécurité, RGPD, indexation et performance.

## 2026-05-12

### Ajouté
- Premières versions publiques : programme PMU complet, PDF des pronostics du jour, lexique, comparateur, favoris, compte à rebours, PWA.
