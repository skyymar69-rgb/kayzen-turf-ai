# Documentation technique — chaîne de prédiction Kayzen Turf

**Version :** 2.0 — 8 octobre 2026 (remplace la version 1.0 du 7 mai 2026, qui décrivait le PronoScore)
**Objet :** ce que le site calcule réellement, dans l'ordre, avec les fichiers de référence.
**Règle :** ce document décrit le code. Quand ils divergent, c'est le code qui fait foi et ce document qui est faux.

---

## 1. Vue d'ensemble

```
API PMU ──► import (scripts/import-pmu-day.mjs, 3×/jour)      ──► base Neon
        └─► boucle en direct (src/lib/live/refresh-race.ts)    ──► cotes, parts des mises, terrain, non-partants
base ──► src/lib/race-repository.ts
           ├─ avis IA : modèle fondamental (src/lib/fundamental/*), sans cote
           └─ calibrateField (src/lib/probability.ts)
                ├─ marché : retrait de marge par exposant γ
                ├─ mélange marché × IA (coefficients estimés, β = 0 aujourd'hui)
                ├─ Top 3 / Top 5 : Plackett-Luce corrigé de Henery
                └─ espérance à la cote finale attendue (src/lib/value-signal.ts)
       ──► profils (src/lib/profiles.ts), confrontation (src/lib/confrontation.ts),
           score de surprise (src/lib/surprise.ts), tickets (src/lib/bet-recommendations.ts)
       ──► pronostics gelés H-60, H-15, H-2 (src/lib/live/freeze.ts)
       ──► backtest nocturne (scripts/backtest.ts) ──► /track-record
```

## 2. Données

### 2.1 Import et intégrité (scripts/import-pmu-day.mjs, scripts/lib/pmu-integrity.mjs)

- **Gel d'avant-course.** Une fois la course partie (heure passée ou arrivée publiée), musique, gains, équipement, œillères, poids, corde, déferrage, cote et probabilités ne sont plus réécrits (`coalesce`). Un import de la veille ou un rattrapage ne peut plus remplacer une donnée d'avant-course par une donnée d'après-course.
- **Statistiques jockey / entraîneur datées.** Tant que la course n'est pas partie, l'import copie les totaux courants dans `entries.*_pre`. La lecture suit `src/lib/point-in-time.ts` : valeur figée si elle existe, sinon totaux courants pour une course à venir, sinon rien (`null`) pour une course passée.
- **Définition unique des statistiques.** `scripts/update-connection-stats.mjs` compte tous les partants des courses ayant un gagnant, jours précédents seulement, comme le jeu d'entraînement (`scripts/lib/dataset.ts`).
- **Ex æquo.** Chaque cheval d'un groupe reçoit la place du groupe ; tout le groupe de tête est gagnant.
- **Musique.** Un seul lecteur (`tokenizeMusic`), porté à l'identique dans l'import : « 0 » vaut 10, les années « (25) » sont ignorées, la lettre de discipline est conservée.
- **Œillères et déferrage.** `equipment` et `blinkers` ne contiennent que les œillères ; le déferrage est dans `shoeing`.
- **Type de départ.** `races.start_type` vaut `autostart` quand le texte `conditions` du PMU le mentionne, `volte` sinon (trot), `null` sans texte. `races.prize` reprend `montantPrix`.
- **Chrono réalisé.** `reduction_km` (le temps de la course elle-même) n'est plus lu par aucun calcul ; seule `speed_figure`, relevée avant le départ, l'est.

### 2.2 Temps réel (src/lib/live/refresh-race.ts)

- Cotes : toutes les 15 min au-delà de H-60, 4 min jusqu'à H-15, 45 s ensuite. Leur origine (`direct`, `reference`, `probable`) est stockée (`entries.odds_source`, `odds_snapshots.odds_source`).
- Terrain : relu au plus toutes les 10 min jusqu'au départ (`races.going`, `going_updated_at`).
- Non-partants : retirés de `entries` et consignés dans `scratches`.
- Pronostic « indicatif » (`src/lib/odds-freshness.ts`) : affiché avant le départ si plus de la moitié des cotes sont probables ou de référence, ou si elles ont plus de 30 min à moins de 2 h du départ.
- Les lectures et écritures des colonnes ajoutées en octobre 2026 tolèrent un schéma pas encore appliqué (`to_jsonb`, requête de repli).

## 3. Probabilités servies (src/lib/probability.ts, src/lib/market-calibration.json)

Ajustement : `scripts/fit-market.ts`, sur 1 562 courses (24/08 → 07/10/2026), ajusté avant le 16/09 et validé après.

| Étape | Méthode | Mesure hors échantillon |
|---|---|---|
| Retrait de marge | p ∝ (1/cote)<sup>γ</sup>, γ = 1,076 | log-loss 1,9737 contre 1,9747 au proportionnel : gain dans le bruit |
| Mélange IA | p ∝ exp(α·log p<sub>marché</sub> + β·log p<sub>IA</sub>) par discipline | β non significatif dans les trois disciplines : β = 0 servi |
| Top 3 / Top 5 | Plackett-Luce, places 2 et 3 tirées avec p<sup>λ</sup> (λ<sub>2</sub> = 0,774, λ<sub>3</sub> = 0,526) | A/E Top 3 ramené de 0,87–1,65 (Harville) à 0,86–1,04 selon la tranche de cote |

`MODEL_VERSION` = `2026.10-marche-gamma-henery` ; il est gravé dans chaque pronostic gelé.

**Conséquence assumée :** la probabilité affichée est le marché recalibré. L'avis de l'IA reste affiché à part, comme second avis, sans promesse de gain.

## 4. Valeur et mises (src/lib/value-signal.ts, src/lib/betting-engine.ts)

- **Cote finale attendue.** La cote affichée rattrape le marché avant le départ (`catchUpShare`, constante de 30 min — hypothèse documentée, à remplacer par un modèle ajusté sur `odds_snapshots`). L'espérance se calcule sur cette cote.
- **Seuils uniques.** Valeur : +10 % d'espérance (`VALUE_EDGE_THRESHOLD`), jamais affichée à plus de 30 min du départ ni sans cote. Ailleurs, le site parle d'« écart IA / marché » (seuil 4 points).
- **Kelly.** Seulement dans le simulateur, seulement si l'espérance à la cote finale attendue est positive, marqué « théorique ». Aucune bankroll ni cote de repli inventée.
- **Tickets combinés.** Retour estimé = P<sub>modèle</sub> × (1 − prélèvement) ÷ P<sub>public</sub>, avec le même modèle d'ordre de Henery. Les tickets sous la mise sont signalés « en dessous de la mise ». Le carré magique est une lecture ludique, sans espérance.

## 5. Modèle fondamental (src/lib/fundamental/*)

- **En service :** format 1, logit conditionnel par discipline, 16 variables (forme, gains, âge, sexe, œillères, entourage, recul, numéro relatif), entraîné avant le 01/06/2026.
- **Prêt à entraîner :** format 2 (`scripts/train-fundamental.ts`, tâche GitHub « Train fundamental model »), entraînement sur les trois premiers (logit éclaté 1 / 0,5 / 0,25), pénalité choisie par validation glissante, et ablation : un groupe de variables n'est gardé que s'il améliore le log-loss hors échantillon.
  - Groupes : forme regroupée (une note pondérée par spécialité), spécialité, corde réelle (`draw`), poids, équipement et déferrage (dont le premier déferrage), récence, places relatives, aptitudes distance / terrain / hippodrome, changement de catégorie, couple cheval-jockey.
  - L'historique est calculé strictement avant la date de la course (`src/lib/fundamental/history.ts`) ; le site ne le charge que si le modèle en service le lit.
- `model.ts` lit les deux formats et calcule exactement les variables listées dans `model.json`.

## 6. Mesure (scripts/backtest.ts, /track-record)

- Cote de décision relevée au moins 15 min avant le départ ; gains sur les rapports officiels PMU.
- Chaque signal a sa date de gel (`PROFILES_FROZEN_AT` = 02/10/2026 pour les profils) : le rapport sépare période d'ajustement et hors échantillon, et la page publie d'abord le hors échantillon et le suivi des pronostics gelés H-2.
- Tests multiples : p-valeur bootstrap unilatérale, correction de Holm (Benjamini-Hochberg indicatif). Signal principal déclaré : `rank1-sp`.
- Indicateurs : ROI et intervalle à 90 %, CLV et part de CLV positive, baisse maximale, plus longue série perdante, A/E par tranche de cote, calibration en tranches logarithmiques, log-loss mensuel (IA, marché, servi), ventilation par discipline et spécialité.
- Tickets du site chiffrés sur `race_payouts` : simples, couplés, trio, 2 sur 4 et multi (ces deux derniers depuis octobre 2026).

## 7. Limites connues

- Contre la cote finale, aucune variable publique n'a encore apporté d'information au-delà du marché (mesure du 08/10/2026 sur 1 571 courses). Le format 2 du modèle doit le démontrer hors échantillon avant de changer β.
- Le rattrapage de la cote (30 min) est une hypothèse tant qu'il n'est pas ajusté sur l'historique horodaté des cotes.
- Les courses passées antérieures au 08/10/2026 n'ont pas de statistiques d'entourage figées : leur avis IA est calculé avec l'entourage à sa valeur a priori.
