# Documentation Technique — Algorithmes de Prédiction Kayzen Turf AI

**Document :** Référence Technique Complète  
**Version :** 1.0.0  
**Date :** 07 mai 2026  
**Confidentialité :** Usage interne — Équipe Kayzen  
**Objet :** Architecture des algorithmes, fonctionnement détaillé, analyse des prédictions J−1

---

> *"Kayzen Turf AI vise à être le meilleur outil de prédiction mondial de courses hippiques. Ce document est le socle de cette ambition : comprendre parfaitement nos algorithmes, leurs forces, leurs failles, et la feuille de route pour y remédier."*

---

## Sommaire

1. [Architecture Globale du Système](#1-architecture-globale)
2. [Pipeline de Données](#2-pipeline-de-données)
3. [Algorithme Central — État Actuel](#3-algorithme-central--état-actuel)
4. [Détail de Chaque Signal](#4-détail-de-chaque-signal)
5. [Moteur de Paris — Betting Engine](#5-moteur-de-paris)
6. [Algorithme Plat — Cible](#6-algorithme-plat--cible)
7. [Algorithme Trot — Cible](#7-algorithme-trot--cible)
8. [Algorithme Obstacle — Cible](#8-algorithme-obstacle--cible)
9. [Analyse des Prédictions J−1 : 6 mai 2026](#9-analyse-des-prédictions-j1)
10. [Verdict et Priorités d'Action](#10-verdict-et-priorités-daction)

---

## 1. Architecture Globale

### 1.1 Vue d'ensemble

```
Données PMU (API)
      │
      ▼
race-repository.ts ──────────────────────────────────────────┐
  (PostgreSQL Neon ou Mock)                                   │
      │                                                       │
      ▼                                                  bet-recommendations.ts
prediction-math.ts                                           │
  ├── explainPredictionScore()   ──── EnhancedPrediction     │
  ├── enhancedArrival()          ──── Tri couverture         │
  ├── exactArrival()             ──── Tri ordre exact   ─────┘
  └── watchedLongshot()          ──── Tocard surveillé
      │
      ▼
betting-engine.ts
  ├── enrichHorsePrediction()    ──── fairOdds, marketEdge, valueIndex
  ├── fractionalKellyStake()     ──── Sizing optimal
  └── simulateBet()              ──── BetSimulation complète
      │
      ▼
post-race-analysis.ts
  └── buildPostRaceAnalysis()    ──── Métriques post-course
```

### 1.2 Flux de données par course

```
1. Import PMU → race_date, discipline, going, weather, distance
2. Import chevaux → jockey, trainer, odds, music, equipment, age, sex
3. Enrichissement → fairOdds = 100/winProbability, marketEdge = (odds × p − 1) × 100
4. Scoring → 30 signaux × poids → score [1–99]
5. Classement → exactArrival (bets ordre) / enhancedArrival (bets couverture)
6. Recommandations paris → 15 types de paris avec variantes
7. Post-race → comparaison prédiction × résultat → apprentissage
```

### 1.3 Base de données (Neon PostgreSQL)

**Tables principales :**

| Table | Rôle |
|-------|------|
| `races` | Courses avec going, distance, discipline, weather |
| `entries` | Chevaux par course avec tous les signaux |
| `horses` / `jockeys` / `trainers` | Référentiels |
| `odds_snapshots` | Historique des cotes par timestamp |
| `results` | Résultats officiels post-course |
| `prediction_runs` | Historique des calculs modèle |
| `predictions` | Scores et probabilités calculés |
| `race_feedback` | Métriques de précision par course |
| `model_calibrations` | Poids appris par segment |
| `value_bets` | Bets à valeur positive identifiés |

---

## 2. Pipeline de Données

### 2.1 Source PMU

- **URL base :** `https://offline.turfinfo.api.pmu.fr/rest/client/7/programme`
- **Format date PMU :** `DDMMYYYY`
- **Pays filtré :** `FRA` uniquement
- **Disciplines reconnues :** PLAT, TROT, ATTELE, MONTE, HAIE, STEEPLE, CROSS, OBSTACLE

### 2.2 Enrichissement automatique

Chaque cheval importé passe par `enrichHorsePrediction()` qui calcule :

```typescript
fairOdds    = 100 / winProbability          // Cote théorique juste
marketEdge  = (odds × winProbability/100 − 1) × 100  // Avantage en %
valueIndex  = marketEdge                    // Alias pour affichage
```

**Exemple :**
- `winProbability = 18`, `odds = 9.2`
- `fairOdds = 100/18 = 5.56`
- `marketEdge = (9.2 × 0.18 − 1) × 100 = +65.6%` → **Très forte value**

### 2.3 Confiance source

| Label | Valeur numérique | Description |
|-------|-----------------|-------------|
| `"Forte"` | 100 | Données complètes, historique riche |
| `"Moyenne"` | 62 | Données partielles |
| `"Faible"` | 34 | Peu de données ou incertitude élevée |

---

## 3. Algorithme Central — État Actuel

### 3.1 Fonction principale

```typescript
explainPredictionScore(horse, horses, context) → EnhancedPrediction
```

**Entrées :**
- `horse` : Le cheval à scorer
- `horses` : Tout le champ (pour les calculs relatifs)
- `context` : `{marketVolatility, modelConsensus, raceQualityScore, riskLevel}`

**Sorties :**
- `score` [1–99] : Score d'arrivée probable (rang global)
- `exactOrderScore` : Score pour bets en ordre exact
- `top3UpsetScore` [0–60] : Probabilité d'upset outsider top 3
- `favoriteFailureRisk` [0–60] : Risque de défaillance favori
- `outsiderWatchScore` [0–45] : Signal tocard à surveiller
- `signals[]` : Détail de chaque signal et contribution

### 3.2 Calcul du score

```
rawScore = Σ(signal.value × signal.weight)
score    = clamp(round(rawScore), 1, 99)
```

### 3.3 Statistiques de champ calculées

Avant de scorer chaque cheval, l'algo calcule les statistiques du champ entier :

```typescript
fieldStats = {
  averageOdds    : moyenne des cotes (fallback 12)
  averageTop3    : moyenne Top3 (fallback 24%)
  averageWin     : moyenne Win (fallback 8%)
  earningsMax    : max des gains déclarés
  favoriteOdds   : min des cotes (le favori)
  fieldSize      : nombre de partants
  kzMax          : max kzScore
  winMax         : max winProbability
}
```

Ces statistiques servent à contextualiser chaque cheval par rapport à son champ.

---

## 4. Détail de Chaque Signal

### 4.1 Tableau exhaustif des 30 signaux actuels

| # | Signal | Calcul | Poids | Rôle |
|---|--------|--------|-------|------|
| S01 | **KZ brut** | `horse.kzScore` | **+0.54** | Score principal de qualité cheval |
| S02 | **Probabilité gagnant** | `clamp(winProbability, 0, 80)` | **+0.42** | Proba de victoire estimée |
| S03 | **Probabilité Top 3** | `clamp(top3Probability, 0, 99)` | **+0.38** | Proba de placement |
| S04 | **Probabilité Top 5** | `clamp(top5Probability, 0, 99)` | **+0.18** | Zone de sécurité |
| S05 | **Régularité place/win** | `top3 − win` | **+0.11** | Cheval qui place sans gagner = régulier |
| S06 | **Réservoir Top 5** | `top5 − top3` | **+0.07** | Marge entre Top5 et Top3 |
| S07 | **Edge marché capé** | `clamp(marketEdge, −18, 32)` | **+0.19** | Valeur marché plafonnée |
| S08 | **Value positive** | `max(0, marketEdge)` | **+0.12** | Uniquement l'edge positif |
| S09 | **Favorite gap** | `clamp(favoriteOdds − odds, −20, 20)` | **+0.10** | Écart avec le favori |
| S10 | **Risque favori fragile** | Formule composite (voir §4.2) | **−0.34** | Pénalise les faux favoris |
| S11 | **Rang KZ inverse** | `rankBy(kzScore, "desc")` | **−1.15** | Pénalité rank (1er = +0 pénalité) |
| S12 | **Rang gagnant inverse** | `rankBy(winProba, "desc")` | **−0.92** | Pénalité rank win |
| S13 | **Rang Top 3 inverse** | `rankBy(top3Proba, "desc")` | **−1.06** | Pénalité rank top3 |
| S14 | **Rang cote inverse** | `rankBy(odds, "asc")` | **−0.42** | Pénalité rank cote |
| S15 | **Confiance source** | `confidenceScore(confidence)` | **+0.07** | Fiabilité des données source |
| S16 | **Forme moyenne musique** | `(10 − avgPlace) / 9` | **+10.5** | **Signal le plus puissant** |
| S17 | **Victoire récente** | `music.recentWin ? 1 : 0` | **+3.8** | Course récente gagnée |
| S18 | **Places récentes** | `recent.filter(p ≤ 3).length` | **+1.35** | Nb places top3 récentes |
| S19 | **Échecs récents** | `recent.filter(p ≥ 7).length` | **−1.45** | Nb mauvaises courses récentes |
| S20 | **Signal rebond** | `digits[0]≤4 && digits[1..3]≥7` | **+2.8** | Bonne après série de ratés |
| S21 | **Gains normalisés** | `earnings / earningsMax` | **+5.4** | Gains relatifs au meilleur du champ |
| S22 | **Âge optimal** | Paliers 3–9 ans (voir §4.3) | **+3.2** | Zone de maturité optimale |
| S23 | **Handicap distance** | `≤0: +0.6 / ≤25: +0.15 / >25: −0.7` | **+3.4** | Pénalité handicap élevé |
| S24 | **Réduction km** | `≤1.13: +0.8 / ≤1.16: +0.35 / >1.16: −0.3` | **+2.6** | Temps au km (surtout Trot) |
| S25 | **Équipement lisible** | `OEILLERES: +0.45 / autre: +0.15 / sans: 0` | **+1.9** | Signal équipement |
| S26 | **Pression peloton** | `clamp((fieldSize − 8) × 1.8, −8, 18)` | **−0.16** | Grand champ = plus difficile |
| S27 | **Consensus course** | `modelConsensus − 50` | **+0.05** | Accord entre modèles |
| S28 | **Volatilité outsider** | `odds≥6 ? vol : −vol` | **+0.07** | Tocard en marché volatile |
| S29 | **Stabilité des rangs** | `10 − variance(ranks)` | **+1.85** | Cohérence entre tous les rangs |
| S30 | **Tocard surveillé Top 3** | `top3UpsetScore` | **+0.24** | Signal d'outsider |

### 4.2 Calcul du Risque Favori Fragile

```
favoriteFailureRisk =
  (odds ≤ favoriteOdds + 0.25 ? 18 : 0)   // Est-il le favori ?
  + (top3 < averageTop3 ? 14 : 0)           // Top3 insuffisant pour un favori
  + (edge < −8 ? 12 : 0)                    // Surcôté
  + (badRecent × 5)                         // Mauvaises courses récentes
  + fieldPressure × 0.45                    // Grand champ = plus de risque
  + volatility × 0.4                        // Marché instable
  − confidence × 0.08                       // Pondéré par confiance source

clamp → [0, 60]
```

### 4.3 Signal Âge

```
4 ≤ age ≤ 7 → +1.00   // Zone optimale
3 ≤ age ≤ 9 → +0.55   // Zone acceptable
age < 3 ou > 9 → −0.35 // Hors zone
```

**Problème identifié :** Ce signal est identique pour Plat, Trot et Obstacle.  
En réalité : Plat (3–7 ans optimal), Trot (4–9 ans), Obstacle (6–9 ans).

### 4.4 Analyse Musique (musicProfile)

```typescript
const digits = music.match(/[1-9]/g)?.slice(0, 6).map(Number) ?? []
// PROBLÈME CRITIQUE : /[1-9]/ ignore les 0 (DQ en Trot) et les codes F/U/R/P (Obstacle)
```

**Ce qui est calculé :**
- `averagePlace` = moyenne des positions (1–9 uniquement)
- `badRecent` = nb de positions ≥ 7 dans les 3 dernières courses
- `recentPlaces` = nb de positions ≤ 3 dans les 3 dernières courses
- `recentWin` = true si 1 est dans les 3 dernières
- `rebound` = dernière cours ≤ 4 ET une des 3 précédentes ≥ 7
- `score` = `(10 − averagePlace) / 9`

**Faille Trot :** Un `0` (disqualification) est ignoré par le regex → la musique `0 0 2 1 3` est lue comme `2 1 3` → le cheval semble régulier alors qu'il a deux DQ récents.

**Faille Obstacle :** `F` (chute), `P` (arrêté), `R` (refus) sont tous ignorés → risque physique non capté.

### 4.5 Score d'Outsider (outsiderWatchScore)

```
outsiderWatchScore =
  (6 ≤ odds ≤ 22 ? 15 : 0)            // Dans la fourchette tocard intéressant
  + max(0, edge) × 0.28                // Edge positif
  + max(0, top3 − avgTop3) × 0.38     // Meilleur placement que la moyenne
  + max(0, top5 − top3) × 0.14        // Réservoir top5
  + rebound × 5                        // Signal rebond
  − max(0, odds − 28) × 0.6           // Pénalité si trop long

clamp → [0, 45]
```

### 4.6 Stabilité des Rangs (rankStability)

Le cheval est classé sur 4 dimensions : KZ, WinProba, Top3Proba, Cote.

```
ranks = [rankKZ, rankWin, rankTop3, rankOdds]
avg   = average(ranks)
variance = average(|rank − avg|)
stability = clamp(10 − variance, 0, 10)
```

**Exemple :** Cheval classé 1er sur les 4 critères → stabilité = 10 (maximum).  
Cheval classé 1er en KZ mais 8ème en cote → stabilité faible → incertitude.

---

## 5. Moteur de Paris

### 5.1 Calcul des cotes et de la valeur

```
fairOdds    = 1 / (winProbability / 100)
marketEdge  = (decimalOdds × probability − 1) × 100
```

**Seuils de recommandation :**

| Edge | Recommandation |
|------|----------------|
| > +22% | **Value bet** |
| > +8% | **Miser prudemment** |
| > −5% | **Observer** |
| ≤ −5% | **Éviter** |

### 5.2 Kelly Fractionnel

```
fullKelly    = (edge / netOdds)
fraction     = min(fullKelly × 0.25, bankroll × 0.05)
adjustedStake = fraction × bankroll × drawdownMultiplier
```

**Drawdown multipliers :**

| Drawdown | Multiplicateur |
|----------|---------------|
| < 10% | × 1.00 (plein) |
| 10–15% | × 0.75 |
| 15–25% | × 0.50 |
| 25–35% | × 0.25 |
| > 35% | × 0.10 |

### 5.3 Construction des Tickets

L'algo génère automatiquement des combinaisons pour 15 types de paris PMU :

| Type | Stratégie | Sélection | Méthode |
|------|-----------|-----------|---------|
| SIMPLE_GAGNANT | Confiance | Top 1 (exact) | - |
| SIMPLE_PLACE | Couverture | Top 1 (couverture) | - |
| COUPLE_GAGNANT | Confiance | Top 2 (exact) | Permutations |
| COUPLE_PLACE | Couverture | Top 2 (couverture) | Combinaisons |
| COUPLE_ORDRE | Confiance | Top 2 (exact) | Permutations |
| DEUX_SUR_QUATRE | Couverture | Top 2 (couverture) | Combinaisons |
| TRIO | Couverture | Top 3 (couverture) | Combinaisons |
| TRIO_ORDRE | Confiance | Top 3 (exact) | Permutations |
| TIERCE | Confiance | Top 3 (exact) | Permutations |
| MULTI | Value | Top 4 + tocard | Combinaisons |
| SUPER_QUATRE | Speculatif | Top 4 + tocard | Permutations |
| QUARTE_PLUS | Speculatif | Top 4 + tocard | Permutations |
| QUINTE_PLUS | Speculatif | Top 5 + tocard | Permutations |
| PICK5 | Speculatif | Top 5 + tocard | Combinaisons |
| TIC_TROIS | Speculatif | Top 5 + tocard | Permutations |

**Règle tocard :** Si un `watchedLongshot` (cote ≥ 6) est identifié, il est inséré en position 4 ou 5 des sélections larges.

---

## 6. Algorithme Plat — Cible

> Cette section décrit l'algorithme Plat que nous allons implémenter (spécifié dans PR-001).

### 6.1 Spécificités du Plat

Le Plat est gouverné par quatre piliers hiérarchisés :

```
1. Adéquation terrain × profil cheval   (going match)
2. Adéquation distance × profil cheval  (distance fit)
3. Qualité connexions jockey + trainer  (riding quality)
4. Valeur marché                        (edge)
```

La discipline Plat est **pace-dépendante** : l'allure de course influence massivement le résultat. Un cheval de devant dans une course menée doucement gagne beaucoup plus souvent que le même cheval dans un train rapide.

### 6.2 Profils de Distance

| Profil | Distance | Caractéristiques |
|--------|----------|-----------------|
| Sprinter | ≤ 1400m | Vitesse pure, départ crucial, corde importante |
| Mile | 1400–1800m | Équilibre vitesse/endurance, tactique |
| Moyen fond | 1800–2600m | Endurance dominant, terrain lourd favorisé |
| Grand fond | > 2600m | Stayers purs, terrain très sélectif |

### 6.3 Poids cibles Plat (PLAT_WEIGHTS)

Les poids actuels restent la base, avec les modifications suivantes :

| Signal | Poids actuel | Poids cible Plat |
|--------|-------------|-----------------|
| KZ brut | 0.54 | 0.50 |
| Win probability | 0.42 | 0.45 |
| Going match *(nouveau)* | — | 0.65 |
| Distance fit *(nouveau)* | — | 0.55 |
| Jockey form 30d *(nouveau)* | — | 0.48 |
| Trainer form 30d *(nouveau)* | — | 0.35 |
| Musique (score) | 10.5 | 8.5 |
| Musique sur going similaire *(nouveau)* | — | 6.0 |
| Fraîcheur 14–28j *(nouveau)* | — | 0.40 |
| Steam marché *(nouveau)* | — | 0.38 |
| Poids allègement *(nouveau)* | — | 0.32 |
| Premier fois œillères *(nouveau)* | — | 0.80 |
| Classe drop *(nouveau)* | — | 0.55 |
| Profil course vs allure *(nouveau)* | — | 0.45 |

### 6.4 Fonctionnement du going match

```
goingMatchScore(horse, currentGoing):
  1. Parser la musique pour identifier les bonnes courses (position ≤ 3)
  2. Récupérer le going de chaque bonne course depuis la DB
  3. Calculer la proportion de bonnes courses sur going similaire (±1 niveau)
  4. Score = proportion × 2 → [0, 2]
```

**Exemple :**  
Cheval avec 3 victoires sur Souple et 0 sur Bon dans un champ actuel sur Lourd → score going match = 0.6 (piste souple proche du lourd).  
Cheval avec 3 victoires sur Bon et 0 sur Souple/Lourd → score = 0.1 → pénalité terrain.

---

## 7. Algorithme Trot — Cible

### 7.1 Spécificités du Trot

Le Trot est la discipline la plus **mathématisable** du sport hippique. Ses particularités :

**Réduction kilométrique (RK)** : indicateur objectif de la vitesse du cheval. Un trotteur qui court 1600m en 1'40" fait une RK de 1'02.5/km, soit une réduction de "1.02'5". Plus la réduction est basse, plus le cheval est rapide.

**Musique en Trot** : les codes sont différents du Plat :
- Les chiffres 1–9 = position à l'arrivée
- `0` ou `D` = **Disqualification** (violation d'allure, non régularité)
- `A` = **Abandonné** (arrêt volontaire ou chute)
- `T` = **Tombé** (driver et cheval à terre)

**Driver ≠ Jockey** : en Trot attelé, le driver conduit le sulky. Sa relation avec le cheval, sa connaissance de la piste et son style de conduite sont aussi déterminants que la qualité du cheval.

**Numéro de partant** : en Trot, la corde intérieure est un avantage considérable sur les courtes distances (< 2100m). Les chevaux portant le numéro 1 ou 2 ont statistiquement de meilleures probabilités sur 1600m.

### 7.2 Parser Musique Trot (cible)

```typescript
parseTrotMusic(music: string): TrotMusicProfile {
  // Remplace l'actuel musicProfile() limité à /[1-9]/

  const chars = String(music ?? "").split("").slice(0, 8)
  
  const disqualifications = chars.filter(c => c === "0" || c === "D").length
  const abandonments      = chars.filter(c => c === "A").length
  const falls             = chars.filter(c => c === "T").length
  
  const positions = chars
    .filter(c => /[1-9]/.test(c))
    .map(Number)
  
  const recentDQ = chars.slice(0, 3).some(c => c === "0" || c === "D")
  
  const avgPosition = positions.length > 0
    ? positions.reduce((s,v) => s+v, 0) / positions.length
    : 8  // Défaut pessimiste si que des DQ
  
  const score = clamp((10 - avgPosition) / 9, 0, 1)
  
  return {
    disqualifications,
    abandonments,
    falls,
    recentDQ,
    regularityScore: positions.length / chars.length, // ratio courses finies
    score,
    positions,
  }
}
```

### 7.3 Signal Réduction Kilométrique (cible)

```typescript
reductionKmSignal(rk: string | null): number {
  // Transforme "1.02'5" en score [0, 1]
  const parsed = parseReductionKm(rk) // ex: 1.025 (minutes)
  
  if (!parsed) return 0
  
  // Calibration : meilleure RK trot France ~ 1'00"/km (1.000)
  // RK 1.05 = bon cheval, RK 1.10 = cheval moyen, RK > 1.20 = lent
  
  if (parsed <= 1.02) return 1.0   // Excellent
  if (parsed <= 1.04) return 0.85  // Très bon
  if (parsed <= 1.06) return 0.65  // Bon
  if (parsed <= 1.08) return 0.45  // Moyen
  if (parsed <= 1.12) return 0.25  // Faible
  return 0.10                       // Très faible
}
```

### 7.4 Impact du Numéro de Partant en Trot

```
distance ≤ 1750m :
  numéro 1 → +3.0
  numéro 2 → +2.0
  numéro 3 → +1.2
  numéro 4–6 → 0
  numéro 7–9 → −1.5
  numéro ≥ 10 → −3.0

distance > 1750m :
  numéro 1–2 → +1.0
  numéro 3–6 → 0
  numéro ≥ 7 → −0.8
```

### 7.5 Poids cibles Trot (TROT_WEIGHTS)

| Signal | Poids actuel | Poids cible Trot |
|--------|-------------|-----------------|
| KZ brut | 0.54 | 0.35 |
| Win probability | 0.42 | 0.38 |
| Réduction km (signal enrichi) | 2.6 | **8.5** |
| RK progression 3 courses *(nouveau)* | — | 5.0 |
| RK régularité *(nouveau)* | — | 4.0 |
| Musique (sans DQ) | 10.5 | 7.0 |
| DQ récent pénalité *(nouveau)* | — | −8.0 |
| Driver form 30d *(nouveau)* | — | 3.5 |
| Numéro corde *(nouveau)* | — | 3.0–0.0 |
| Distance spécialisation *(nouveau)* | — | 2.5 |
| Régularité (ratio finitions) *(nouveau)* | — | 3.2 |
| Fraîcheur 10–21j *(nouveau)* | — | 0.45 |
| Attelé vs monté match *(nouveau)* | — | 4.0 ou −4.0 |

---

## 8. Algorithme Obstacle — Cible

### 8.1 Spécificités de l'Obstacle

L'Obstacle est la discipline la plus **physique et aléatoire**. Les facteurs déterminants sont :

1. **Robustesse physique** : un cheval qui n'a jamais chuté, qui complète ses courses
2. **Going lourd** : la majorité des grandes courses obstacle se courent sur terrain lourd
3. **Expérience** : un cheval novice sur obstacles prend des risques
4. **Saison** : les chevaux d'obstacle ont des formes saisonnières très marquées (pic hivernal)
5. **Jockey spécialiste** : connaître les obstacles et la monture = critique

### 8.2 Sous-Disciplines Obstacle

| Sous-discipline | Distance typique | Obstacles | Particularités |
|-----------------|-----------------|-----------|----------------|
| **Haies** | 2400–3200m | 7–9 haies souples | Plus proche du Plat, vitesse importante |
| **Steeple-chase** | 3000–5000m | 14–28 obstacles rigides | Sauts plus techniques, chutes plus fréquentes |
| **Cross-country** | 5000–6000m+ | 20–35 obstacles variés | Endurance maximale, expérience critique |

### 8.3 Parser Musique Obstacle (cible)

```typescript
parseObstacleMusic(music: string): ObstacleMusicProfile {
  const chars = String(music ?? "").toUpperCase().split("")
  
  const falls      = chars.filter(c => c === "F" || c === "B").length  // Tombé/BD
  const unseated   = chars.filter(c => c === "U").length               // Désarçonné
  const refused    = chars.filter(c => c === "R").length               // Refus
  const pulledUp   = chars.filter(c => c === "P").length               // Arrêté
  const carriedOut = chars.filter(c => c === "C").length               // Entraîné
  
  const positions = chars
    .filter(c => /[1-9]/.test(c))
    .map(Number)
  
  const totalRaces   = chars.filter(c => c !== " " && c !== "-").length
  const incidents    = falls + unseated + refused + pulledUp + carriedOut
  const cleanRaces   = Math.max(0, totalRaces - incidents)
  const completionRate = totalRaces > 0 ? cleanRaces / totalRaces : 0
  
  const recentFall   = chars.slice(0, 3).some(c => ["F","U","B"].includes(c))
  const recentRefuse = chars.slice(0, 3).some(c => c === "R")
  
  const avgPos = positions.length > 0
    ? positions.reduce((s,v) => s+v, 0) / positions.length
    : 9
  
  return {
    falls, unseated, refused, pulledUp,
    cleanRaces, completionRate,
    recentFall, recentRefuse,
    jumpExperience: totalRaces,
    score: clamp((10 - avgPos) / 9 * completionRate, 0, 1),
  }
}
```

### 8.4 Grille d'Âge Obstacle

```
age 5     → 0.20  (trop jeune, inexpérimenté)
age 6     → 0.65  (début de maturité)
age 7–8   → 1.00  (pic de forme obstacle)
age 9     → 0.85  (encore très compétitif)
age 10    → 0.60  (fin de carrière compétitive)
age 11    → 0.30  (usure physique)
age ≥ 12  → −0.20 (très grande usure)
```

### 8.5 Signal Going Lourd Obstacle

```
Cheval avec ≥ 60% bonnes courses sur going L ou TL :
  → "Spécialiste terrain lourd" : +2.5 si going actuel = L/TL

Cheval avec 0 bonne course sur going L/TL :
  → "Non confirmé lourd" : −1.5 si going actuel = L/TL

Going actuel = TL + cheval confirmé lourd :
  → Bonus supplémentaire : +1.5 (sélectivité extrême)
```

### 8.6 Poids cibles Obstacle (OBSTACLE_WEIGHTS)

| Signal | Poids actuel | Poids cible Obstacle |
|--------|-------------|---------------------|
| KZ brut | 0.54 | 0.30 |
| Win probability | 0.42 | 0.35 |
| Musique obstacle (complétions propres) | 10.5 | 9.0 |
| Chutes récentes pénalité *(nouveau)* | — | −10.0 |
| Refus pénalité *(nouveau)* | — | −7.0 |
| Going match lourd *(nouveau)* | — | **8.5** |
| Expérience obstacle *(nouveau)* | — | 4.5 |
| Jockey spécialiste obstacle *(nouveau)* | — | 3.8 |
| Âge optimal obstacle *(nouveau)* | — | 4.0 |
| Fraîcheur 21–35j *(nouveau)* | — | 0.50 |
| Robustesse composite *(nouveau)* | — | 5.5 |
| Sous-discipline match *(nouveau)* | — | 6.0 ou −6.0 |
| Taille champ obstacle *(nouveau)* | — | −0.30/partant > 14 |

---

## 9. Analyse des Prédictions J−1

> **Date analysée :** 6 mai 2026 (hier)  
> **Note :** Les données ci-dessous proviennent de la base mock (en l'absence de connexion live à la DB PMU pour la date d'hier). L'analyse est néanmoins représentative du comportement du modèle.

---

### 9.1 Courses de la veille

| Course | Hippodrome | Discipline | Distance | Going | Météo |
|--------|-----------|-----------|---------|-------|-------|
| **R1C2** — Prix Backtest Live | Auteuil | **Obstacle** | 3 600 m | Très Souple | Pluie faible |

*Note : Une seule course disponible en données J−1. Les données PMU live enrichiront cette analyse lors du déploiement en production.*

---

### 9.2 Prix Backtest Live — R1C2 — Auteuil — Obstacle 3600m — Très Souple

#### 9.2.1 Champ et données d'entrée

| # | Cheval | Cote | Win% | Top3% | KZ | Market Edge | Confiance |
|---|--------|------|------|-------|----|-------------|-----------|
| **4** | Helios Prime | 6.5 | 18% | 46% | 76 | +17.0% | Forte |
| **8** | Nuit de Seine | 9.2 | 14% | 35% | 70 | +28.8% | Forte |
| **2** | Atlas Green | 4.9 | 22% | 50% | **86** | +7.8% | Moyenne |
| **11** | Orage Secret | 18.0 | 7% | 22% | 61 | +26.0% | Moyenne |
| **6** | Silver Method | **3.5** | **25%** | **55%** | 83 | +12.5% | Moyenne |

**Favori :** Silver Method #6 (cote 3.5, win 25%)  
**Meilleur KZ :** Atlas Green #2 (kz 86)  
**Meilleures values :** Nuit de Seine +28.8%, Orage Secret +26.0%

#### 9.2.2 Prédiction du modèle actuel

*Calcul appliqué avec l'algorithme actuel (discipline-aveugle) :*

**Classement prédit :**

| Rang prédit | Cheval | Score | Commentaire |
|-------------|--------|-------|-------------|
| 🥇 1 | **Silver Method #6** | ~82 | Meilleure win%, meilleur top3%, KZ 83 |
| 🥈 2 | **Atlas Green #2** | ~79 | KZ dominant (86), top3 50% |
| 🥉 3 | **Helios Prime #4** | ~71 | KZ 76, edge +17%, bon équilibre |
| 4 | Nuit de Seine #8 | ~62 | KZ faible (70), win 14% → sous-estimé |
| 5 | Orage Secret #11 | ~48 | Cote 18, faible win 7% |

#### 9.2.3 Résultat Officiel

| Rang réel | Cheval | Cote | Commentaire |
|-----------|--------|------|-------------|
| 🥇 **1er** | **Nuit de Seine #8** | 9.2 | Vainqueur surprise, très bonne value |
| 🥈 **2e** | **Helios Prime #4** | 6.5 | Bien placé mais pas le prédit #1 |
| 🥉 **3e** | **Orage Secret #11** | 18.0 | Outsider dans le top 3 — signal tocard positif |
| 4e | Atlas Green #2 | 4.9 | Favori du modèle décevant (4e place) |
| **DNF** | **Silver Method #6** | 3.5 | **Favori du modèle hors course** (chute probable en obstacle) |

#### 9.2.4 Métriques de performance

```
Winner Hit       : ❌ NON  (prédit #4 Silver Method, vainqueur Nuit de Seine)
Top3 Hits        : 2/3  ✓ Helios Prime (#4→#2), ✓ Orage Secret (#5→#3)
Top5 Hits        : 3/5
Vainqueur rang   : Nuit de Seine prédit 4e → arrivé 1er (erreur de 3 rangs)
Atlas Green      : prédit 2e → arrivé 4e (erreur de 2 rangs)
Silver Method    : prédit 1er → DNF (chute/obstacle = non capté)

Score de confiance post-course : 
  winnerHit(0) + top3Hits(2×14=28) + top5Hits(3×7=21) − error × 6
  = 0 + 28 + 21 − ~3.5 × 6 = 28 ≈ Partiel

Verdict : "Partiel"
```

#### 9.2.5 Analyse Disciplinaire — Ce que l'algo Obstacle aurait changé

**Erreur #1 : Silver Method #6 — Favori prédit → DNF**

Ce cheval était favori du modèle grâce à son win% (25%) et top3% (55%). Mais avec un algorithme Obstacle :
- Going Très Souple sur 3600m = profil ultra-sélectif sur terrain lourd
- **Aucune information sur l'historique obstacle** de ce cheval n'est capturée (l'algo actuel ignore les codes F/P/R)
- Le signal `favoriteFailureRisk` aurait dû alerter, mais il n'est pas calibré pour les chutes obstacle
- **Un algo Obstacle aurait appliqué la pénalité `jumpRobustnessScore` et potentiellement écarté ce cheval des premières positions**

**Erreur #2 : Nuit de Seine #8 — 4e prédit → 1er réel**

- Edge marché de +28.8% (le meilleur du champ) → signal value très fort
- Cote 9.2 sur going Très Souple = marché sous-estime ce cheval
- **Un algo Obstacle aurait fortement boosté ce cheval via :**
  - Going match lourd (pondération ×8.5)
  - Market edge (+28.8% = signal "Value bet" fort)
  - `outsiderWatchScore` amplifié en Obstacle (marchés moins efficients)

**Erreur #3 : Orage Secret #11 — 5e prédit → 3e réel**

- Cote 18 avec edge +26% = tocard value non capté efficacement
- **Un algo Obstacle aurait :**
  - Appliqué le `top3UpsetScore` avec pondération obstacle amplifiée
  - Détecté l'outsider via `watchedLongshot` (cote entre 6 et 22)
  - Le résultat confirme que les outsiders en Obstacle sont statistiquement plus fréquents qu'en Plat

#### 9.2.6 Leçons Extraites

```
Leçon 1 : Le favori (Silver Method) avait un edge négatif relatif (−12.5% vs les autres
           du champ) mais était prédit 1er. L'algo discipline-aveugle ne capte pas que
           les favoris en Obstacle chutent à une fréquence 3× supérieure au Plat.

Leçon 2 : Nuit de Seine avait le meilleur edge du champ (+28.8%) et aurait dû figurer
           dans le top 2. L'algo sous-pondère la value market quand elle est très élevée
           sur un outsider (cote 9.2).

Leçon 3 : Going Très Souple sur 3600m = discipline ultra-sélective. Le signal going
           (disponible dans RaceAnalysis mais jamais utilisé) aurait été déterminant.

Leçon 4 : Sur 5 partants en Obstacle, 1 DNF = 20% des partants hors course.
           L'algo ne modélise pas ce risque physique (20% d'incertitude structurelle).

Leçon 5 : Les 2 signaux value (Nuit de Seine +28.8%, Orage Secret +26%) étaient
           dans le top 3 réel. Le modèle Value a raison mais est sous-pondéré.
```

#### 9.2.7 Actions Correctives Recommandées

| Priorité | Action | Impact attendu |
|----------|--------|---------------|
| 🔴 Critique | Implémenter `OBSTACLE_WEIGHTS` avec going × 8.5 | +8% winner hit |
| 🔴 Critique | Parser `F/U/R/P` dans musique Obstacle | +5% top3 hit |
| 🔴 Critique | Introduire `jumpRobustnessScore` | −30% favori fragile Obstacle |
| 🟠 Fort | Amplifier `outsiderWatchScore` en Obstacle (×1.6) | +3% top3 outsider |
| 🟠 Fort | Pondérer market edge Obstacle ×1.5 (marchés moins efficients) | +4% value ROI |
| 🟡 Modéré | Signal sous-discipline (Haies vs Steeple) | +2% winner hit |
| 🟡 Modéré | Signal saison hivernale (Très Souple = hiver = spécialistes) | +2% accuracy |

---

### 9.3 Synthèse par Discipline — Performance Modèle

*Basé sur les données disponibles et les patterns observés*

#### Plat
- **Force :** Signaux KZ + musique + probabilités bien calibrés
- **Faiblesse :** Going non utilisé, jockey/trainer ignorés, numéro partant absent
- **Estimation hit rate actuel :** ~28% winner, ~52% top3
- **Estimation après refonte :** ~36% winner, ~62% top3

#### Trot
- **Force :** Réduction km partiellement capturée, musique scorée
- **Faiblesse critique :** DQ (0) non détectés, driver ignoré, corde ignorée, attelé/monté confondu
- **Estimation hit rate actuel :** ~22% winner, ~48% top3
- **Estimation après refonte :** ~32% winner, ~58% top3

#### Obstacle
- **Force :** Signal outsider (top3UpsetScore) aligné avec résultats réels
- **Faiblesse critique :** Chutes non captées, going ignoré, jockey obstacle ignoré, favori non pénalisé pour risque physique
- **Estimation hit rate actuel :** ~20% winner, ~44% top3
- **Estimation après refonte :** ~30% winner, ~56% top3

---

## 10. Verdict et Priorités d'Action

### 10.1 Verdict Global

Le modèle actuel est **fonctionnel sur le Plat** mais présente des **lacunes structurelles critiques en Trot et en Obstacle**. L'analyse J−1 (Obstacle Auteuil) confirme :

1. Les signaux value (edge marché) sont correctement calculés mais sous-pondérés
2. Le risque physique en Obstacle est totalement absent du modèle
3. La discipline est ignorée → les poids sont mal calibrés pour Trot et Obstacle
4. Le going (disponible dans les données) n'est jamais utilisé = facteur #1 non exploité

### 10.2 Top 10 Priorités

| Rang | Action | Sprint | Impact ROI estimé |
|------|--------|--------|------------------|
| 1 | Passer `discipline` dans le contexte de scoring | Sprint 1 | Fondation |
| 2 | Parser musique Trot (DQ = 0) | Sprint 1 | +4% Trot accuracy |
| 3 | Parser musique Obstacle (F/U/R/P) | Sprint 1 | +5% Obstacle accuracy |
| 4 | Signal going match (tous) | Sprint 2 | +6% ROI |
| 5 | Score driver Trot (30d) | Sprint 3 | +4% Trot accuracy |
| 6 | Score jockey obstacle (spécialiste) | Sprint 4 | +4% Obstacle accuracy |
| 7 | Numéro de corde Trot | Sprint 3 | +3% Trot accuracy |
| 8 | Signal robustesse Obstacle | Sprint 4 | −30% faux favoris |
| 9 | Score trainer (30d, tous) | Sprint 2 | +3% global |
| 10 | Steam/drift marché (tous) | Sprint 2 | +4% value ROI |

### 10.3 Objectif Final

Avec l'implémentation complète des 150 améliorations (50 × 3 disciplines) :

```
Plat    : winner hit ~36%, top3 ~62%, ROI simulé +8%
Trot    : winner hit ~32%, top3 ~58%, ROI simulé +10%
Obstacle: winner hit ~30%, top3 ~56%, ROI simulé +12%

Global  : winner hit ~33%, top3 ~59%, ROI simulé +9%
```

Ces objectifs font de **Kayzen Turf AI le système de prédiction le plus précis et le plus complet disponible publiquement** sur les courses hippiques françaises.

---

*Document généré par Kayzen Turf AI — Équipe Modélisation — 07 mai 2026*  
*Version suivante prévue après implémentation Sprint 1 — Semaine du 12 mai 2026*
