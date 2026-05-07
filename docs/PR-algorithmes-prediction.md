# PR-001 — Refonte Complète des Algorithmes de Prédiction par Discipline

**Version :** 1.0.0  
**Date :** 07 mai 2026  
**Auteur :** Kayzen Turf AI — Équipe Modélisation  
**Statut :** Spécification technique — En attente d'implémentation  
**Priorité :** Critique  

---

## 1. Résumé Exécutif

L'algorithme de prédiction actuel (`prediction-math.ts`) est **discipline-aveugle** : il applique un jeu de poids identique aux courses de Plat, de Trot et d'Obstacle. Cette absence de spécialisation est la limite structurelle la plus importante du modèle. Les trois disciplines sont des sports fondamentalement différents, avec des facteurs déterminants distincts, des distributions de probabilités distinctes, et des dynamiques de marché distinctes.

Ce PR définit la refonte complète vers **trois algorithmes indépendants**, chacun nourri par l'ensemble exhaustif des facteurs pertinents à sa discipline. L'objectif est de positionner Kayzen Turf AI comme **le meilleur outil de prédiction mondial de courses hippiques**.

---

## 2. Audit de l'Algorithme Actuel

### 2.1 Architecture existante

```
explainPredictionScore(horse, horses, context)
  → RaceContext = { marketVolatility, modelConsensus, raceQualityScore, riskLevel }
  → 30 signaux × poids fixes
  → score [1-99] + exactOrderScore + top3UpsetScore + favoriteFailureRisk
```

**`discipline`** est déclaré dans `RaceAnalysis` (`"Plat" | "Trot" | "Obstacle"`) mais **n'est jamais transmis** aux fonctions de scoring. L'ensemble du pipeline ignore la discipline.

### 2.2 Signaux actuels (30 signaux)

| Famille | Signaux | Poids |
|---------|---------|-------|
| Score KZ | kzScore brut | 0.54 |
| Probabilités | Win, Top3, Top5, régularité place/win | 0.07–0.42 |
| Marché | Edge capé, value positive, favorite gap | 0.10–0.19 |
| Risque | Risque favori fragile, tocard Top3 | 0.24–0.34 |
| Rangs inverses | Rang KZ, Win, Top3, Cote | −0.42 à −1.15 |
| Confiance | Niveau confiance source | 0.07 |
| Musique | Score forme, victoire récente, places, échecs, rebond | 1.35–10.5 |
| Gains | Gains normalisés | 5.4 |
| Cheval | Âge, handicap distance, réduction km, équipement | 1.9–3.4 |
| Contexte | Pression peloton, consensus, volatilité outsider, stabilité rangs | 0.05–1.85 |

### 2.3 Lacunes critiques identifiées

| # | Lacune | Impact estimé |
|---|--------|---------------|
| L1 | Discipline non prise en compte | Majeur — biais structurel permanent |
| L2 | Météo et terrain non utilisés en scoring | Majeur |
| L3 | Jockey non scoré (champ présent mais ignoré) | Majeur en Plat et Obstacle |
| L4 | Driver non scoré (crucial en Trot) | Critique en Trot |
| L5 | Entraîneur non scoré | Majeur |
| L6 | Musique interprétée identiquement (0 = trot DQ ou plat 10e) | Critique en Trot |
| L7 | Numéro de partant non utilisé | Majeur en Trot et Plat sprint |
| L8 | Distance optimale non croisée avec distance de course | Modéré |
| L9 | Going non croisé avec préférence cheval | Majeur |
| L10 | Changement d'équipement non détecté | Modéré |
| L11 | Fraîcheur (jours depuis dernière course) non scorée | Modéré |
| L12 | Mouvements de cotes non captés | Modéré |
| L13 | Type de course obstacle (haies/steeple/cross) ignoré | Critique en Obstacle |
| L14 | Historique chutes non capté | Critique en Obstacle |
| L15 | Classe de course (drop/rise) non intégrée | Modéré |

---

## 3. Matrice Universelle des Facteurs — Toutes Disciplines

Cette section documente **tous les facteurs exploitables** en prédiction hippique, indépendamment de la discipline.

### 3.1 Météo et Conditions Atmosphériques

| Facteur | Description | Source de données |
|---------|-------------|-------------------|
| Température | Affecte la résistance, le comportement et le terrain | API météo, données PMU |
| Humidité relative | Influence le going indépendamment des précipitations | API météo |
| Vitesse du vent | Vent de face dans la ligne droite = ralentissement sprint | Station météo hippodrome |
| Direction du vent | Vent favorable ou défavorable selon configuration de piste | Station météo hippodrome |
| Précipitations 24h | Accumulation d'eau = going plus lourd | API météo |
| Précipitations 72h | Saturation du sol | API météo |
| Pression barométrique | Basse pression = comportement plus nerveux | API météo |
| Rayonnement solaire | Durcit le terrain en été | API météo |
| Brouillard | Impact sur décisions tactiques des jockeys | Station météo hippodrome |
| Gel nocturne | Peut modifier l'état du sol en cours de journée | Station météo hippodrome |

### 3.2 Terrain / Going

| Code PMU | Description | Avantage |
|----------|-------------|----------|
| Très Bon (TB) | Sol dur, rapide | Chevaux rapides, légers |
| Bon (B) | Sol idéal | Neutre |
| Bon à Léger (BL) | Début d'assèchement | Polyvalents |
| Bon à Souple (BS) | Légèrement souple | Réguliers |
| Souple (S) | Sol mou | Stayers, obstacles |
| Lourd (L) | Sol très mou | Spécialistes terrain lourd |
| Très Lourd (TL) | Conditions extrêmes | Ultra-sélectif |

Facteurs going avancés :
- Évolution du going en cours de journée (courses matinales vs après-midi)
- Going différentiel corde intérieure vs extérieure
- Saturation annuelle du terrain (drainage de l'hippodrome)
- Historique des performances du cheval par code going

### 3.3 Jockey / Driver

| Facteur | Plat | Trot | Obstacle |
|---------|------|------|----------|
| Taux de victoire 7 jours | ✓ | Driver | ✓ |
| Taux de victoire 30 jours | ✓ | Driver | ✓ |
| Taux de victoire saison | ✓ | Driver | ✓ |
| Taux spécifique hippodrome | ✓ | ✓ | ✓ |
| Taux spécifique distance | ✓ | ✓ | ✓ |
| Historique avec ce cheval | ✓ | ✓ | ✓ |
| Changement (nouveau montant) | Signal | Signal driver | Signal fort |
| Récupération du montant attitré | Signal | Signal fort | Signal |
| Allowance/allègement apprenti | ✓ | — | Conditionnel |
| Expérience grande course | ✓ | — | ✓ |
| Spécialisation sous-discipline | — | Attelé/Monté | Haies/Steeple |

### 3.4 Entraîneur

| Facteur | Description |
|---------|-------------|
| Taux victoire 7j | Strike rate immédiat |
| Taux victoire 30j | Forme récente de l'écurie |
| Taux victoire saison | Référence de base |
| Taux hippodrome spécifique | Certains entraîneurs excellents sur certaines pistes |
| Taux distance spécifique | Spécialistes sprint vs fond |
| Taux première sortie après repos | Signal de préparation soignée |
| Taux descente en classe | Entraîneur exploitant tactiquement le niveau |
| Taux avec changement d'équipement | Fiabilité des "pièges" à equipment |
| Taux écurie en forme | Plusieurs gagnants en 7 jours = yard chaud |
| Taux par discipline | Obstacle vs Plat vs Trot |
| Duo entraîneur-jockey | Taux de réussite en binôme |

### 3.5 Équipement

| Équipement | Signal | Force |
|------------|--------|-------|
| Première fois œillères | Fort positif | Réduction des distractions |
| Retrait des œillères | Modéré | Libération de l'attention |
| Première fois jugulaire | Positif | Meilleur contrôle |
| Première fois visière | Modéré positif | Variante oeillères |
| Retrait jugulaire | Neutre à positif | Confiance en régularité |
| Première fois couvre-nuque | Positif en obstacle | Stabilisation |
| Changement de fers | Potentiel positif | Adaptation terrain |
| Tout changement d'équipement | Signal à analyser | Indique un travail |

### 3.6 Musique / Historique de Forme

| Facteur | Description |
|---------|-------------|
| Score moyen brut | Moyenne des places (filtré DQ en Trot) |
| Pondération récente exponentielle | Courses récentes × 2, courses > 6 mois × 0.5 |
| Forme sur going similaire | Filtrer la musique par going identique ±1 niveau |
| Forme sur distance similaire | Filtrer par ±200m autour de la distance cible |
| Forme sur hippodrome identique | Historique spécifique à la piste |
| Pattern ascendant | Amélioration sur 3 dernières courses |
| Pattern descendant | Dégradation sur 3 dernières courses |
| Score de constance | Variance des positions (faible variance = fiable) |
| Victoire récente (dernier) | Course précédente gagnée = fort signal |
| Enchaînement victoires | 2+ victoires consécutives = confiance maximale |
| Signal de rebond | Mauvaise course après une belle série = rebond probable |
| Marge de victoire | Gagner de longueurs = dominance vs victoire serrée |
| Marge de défaite | Battu d'une tête dans une course plus forte = value |
| Qualité des adversaires battus | Niveau des chevaux vaincus lors des victoires |
| Position dans la course | A mené, suivi, décalé ou relancé |

### 3.7 Marché / Cotes

| Facteur | Description |
|---------|-------------|
| Prix d'ouverture | Cote avant l'affluence du marché |
| Prix courant | Cote au moment de l'analyse |
| Mouvement dernière heure | Baisse > 20% = "steam" (argent fort) |
| Mouvement 2h | Tendance globale de la session |
| Divergence Win/Place | Place cote mieux que le win = signe de place |
| Volume marché | Marché épais (PMU gros enjeux) vs fin (petite réunion) |
| Détection smart money | Chute soudaine non expliquée = signal fort |
| Overlay | Cote > cote juste = valeur positive |
| Underlay | Cote < cote juste = surcoté |
| Favori résistant | Favori avec edge négatif = zone dangereuse |

### 3.8 Dynamique de Course / Allure

| Facteur | Description |
|---------|-------------|
| Allure prévisible | Lente, modérée, rapide, très rapide |
| Nombre de fronts | Chevaux aimant mener dans le champ |
| Nombre de closers | Chevaux qui remontent en fin de course |
| Favorabilité allure | Adéquation style du cheval avec allure attendue |
| Position dessinée | Numéro de partant → position probable en course |
| Piste large vs étroite | Impact du peloton sur les trajectoires |

### 3.9 Caractéristiques Physiques du Cheval

| Facteur | Description |
|---------|-------------|
| Âge | Courbe de développement discipline-spécifique |
| Sexe | Pouliches vs mâles vs hongres vs juments vs étalons |
| Hongre récent | Castration < 12 mois = souvent amélioration |
| Poids porté | Plat handicap = différentiel poids critique |
| Allègement de poids | Réduction vs course précédente |
| Pedigree going | Ascendance spécialisée terrain lourd/léger |
| Pedigree distance | Ascendance stayer vs sprinter |
| Fraîcheur physique | Jours depuis dernière course |
| Kilométrage saison | Trop de courses = fatigue cumulative |

### 3.10 Classe et Niveau

| Facteur | Description |
|---------|-------------|
| Niveau de course | Groupe 1/2/3, Listed, Conditions, Handicap, Réclamer |
| Descente en classe | Forte valeur positive (drop de niveau) |
| Montée en classe | Pénalité (affronter meilleur niveau) |
| Qualité du champ actuel | Force des adversaires ce jour |
| Historique de classe | A déjà gagné à ce niveau ou supérieur |
| Indice de classe des gains | Earnings ajustés par qualité des courses |

---

## 4. Spécifications — 50 Améliorations PLAT

Le Plat est la discipline de **vitesse et de tactique**. L'allure, le terrain, la position de départ et la classe des adversaires sont les quatre piliers. L'algorithme Plat doit être calibré pour détecter l'adéquation speed-profile × conditions × niveau.

### 4.1 Contexte Technique

- Distance : 800m à 4000m
- Terrain : Très Bon à Lourd
- Caractère : Pace-dépendant, position départ critique
- Profils : Sprinter (≤ 1400m), Mile (1400–1800m), Moyen fond (1800–2600m), Grand fond (> 2600m)
- Poids : Handicap (différentiel poids = 1 kg ≈ 0.2 longueur)

### 4.2 Les 50 Améliorations

| # | Amélioration | Famille | Implémentation | Impact |
|---|-------------|---------|----------------|--------|
| P01 | **Routing discipline** — passer `discipline` dans `RaceContext` et brancher sur algorithme Plat-specific | Architecture | `RaceContext.discipline = race.discipline` | Critique |
| P02 | **Signal numéro de partant × distance** — bonus corde si distance < 1400m, pénalité extérieur si > 1800m grand peloton | Position | `drawSignal(number, distance, fieldSize)` | Fort |
| P03 | **Going match score** — croiser le `going` de la course avec l'historique du cheval sur going similaire (filtrer musique) | Terrain | `goingMatchScore(horse.music, race.going)` | Fort |
| P04 | **Distance optimale vs distance réelle** — calculer l'écart entre la distance d'optimalité estimée et la distance réelle | Distance | `distanceGapSignal(horse, race.distance)` | Fort |
| P05 | **Profil de course sprint/mile/fond** — appliquer des poids différents selon la catégorie de distance | Distance | Enum `DistanceProfile` + poids par profil | Fort |
| P06 | **Score jockey 7 jours** — taux de victoire du jockey sur les 7 derniers jours | Jockey | `jockeyForm7d(horse.jockey, races)` | Fort |
| P07 | **Score jockey 30 jours** — taux de victoire sur 30 jours | Jockey | `jockeyForm30d(horse.jockey, races)` | Fort |
| P08 | **Score jockey hippodrome spécifique** — taux de victoire de ce jockey sur cet hippodrome | Jockey | `jockeyTrackRecord(horse.jockey, racecourse)` | Modéré |
| P09 | **Partenariat jockey-cheval** — nombre de courses ensemble et taux de réussite | Jockey | `partnershipScore(jockey, horse, results)` | Modéré |
| P10 | **Changement de jockey (top montant)** — remplacement par un jockey de référence = signal positif fort | Jockey | `jockeyChangeSignal(prev, current, topJockeys)` | Fort |
| P11 | **Score entraîneur 30 jours** — strike rate récent de l'entraîneur | Trainer | `trainerForm30d(horse.trainer, races)` | Fort |
| P12 | **Score entraîneur hippodrome** — spécialisation piste | Trainer | `trainerTrackRecord(horse.trainer, racecourse)` | Modéré |
| P13 | **Taux entraîneur première sortie après repos** — signal de préparation ciblée | Trainer | `trainerReturnRate(horse.trainer)` | Modéré |
| P14 | **Taux entraîneur descente de classe** — exploite les drops tactiques | Trainer | `trainerClassDropRate(horse.trainer)` | Fort |
| P15 | **Écurie en forme** — si l'entraîneur a gagné 2+ fois en 7 jours = signal yard chaud | Trainer | `yardForm(horse.trainer, recentResults)` | Fort |
| P16 | **Poids porté et allègement** — différentiel poids vs course précédente (−1 kg = +0.2 longueur estimée) | Poids | `weightSignal(currentWeight, previousWeight)` | Modéré |
| P17 | **Allègement jockey apprenti** — correction allowance (−3, −5, −7 kg selon expérience) | Poids | `claimAllowanceSignal(jockey.apprentice)` | Modéré |
| P18 | **Premier fois œillères** — premier départ avec œillères = signal positif fort (historiquement ~+15% de hit) | Équipement | Detect first `equipment.blinkers` in history | Fort |
| P19 | **Changement d'équipement quelconque** — tout changement = signal de travail de l'entraîneur | Équipement | `equipmentChangeSignal(prev, current)` | Modéré |
| P20 | **Musique pondérée exponentiellement** — courses récentes × 2.0, courses > 90j × 0.6, > 180j × 0.3 | Forme | Reweight `musicProfile()` with decay | Fort |
| P21 | **Musique sur going similaire** — filtrer la musique par going ±1 niveau PMU | Forme | `musicOnGoing(music, currentGoing)` | Fort |
| P22 | **Musique sur distance similaire** — filtrer par distance ±300m | Forme | `musicOnDistance(music, currentDistance)` | Fort |
| P23 | **Musique sur hippodrome identique** — performances sur cette piste spécifique | Forme | `musicOnTrack(music, racecourse)` | Modéré |
| P24 | **Pattern de forme ascendant** — 3 améliorations consécutives = momentum fort | Forme | `ascendingPattern(recentPositions)` | Fort |
| P25 | **Marge de victoire précédente** — gagné de longueurs vs nez = dominance vs chance | Forme | `victoryMarginSignal(lastRace.margin)` | Modéré |
| P26 | **Marge de défaite dans classe supérieure** — battu d'une tête contre meilleur niveau = value | Forme | `classAdaptedMarginSignal(horse, race)` | Fort |
| P27 | **Fraîcheur optimale** — jours depuis dernière course : 14–28j = optimal plat, < 7j ou > 60j = pénalité | Fraîcheur | `freshnessSignal(daysSinceLastRace, "PLAT")` | Fort |
| P28 | **Courbe âge 3 ans** — les 3 ans montent en puissance mars–septembre, coriger l'interprétation | Âge | `ageSeasonCurve(age, raceMonth, "PLAT")` | Modéré |
| P29 | **Hongre récent** — castration < 12 mois = bonus régularité | Sexe | `geldingBonus(sex, geldingDate)` | Modéré |
| P30 | **Forme sexe-distance** — juments souvent supérieures sur fond en terrain souple | Sexe | `sexDistanceGoingSignal(sex, distance, going)` | Modéré |
| P31 | **Descente de classe** — passage à un niveau inférieur = signal valeur fort | Classe | `classDropSignal(currentClass, previousClass)` | Fort |
| P32 | **Montée de classe** — pénalité si affronter nettement meilleur niveau | Classe | `classRiseSignal(currentClass, previousClass)` | Modéré |
| P33 | **Qualité des adversaires battus** — a battu des chevaux classés dans des courses de référence | Classe | `beatenQualityScore(horse.results, raceDb)` | Fort |
| P34 | **Style de course vs allure prévue** — front runner dans course lente = avantage, dans course rapide = risque | Allure | `paceMatchSignal(horse.style, expectedPace)` | Fort |
| P35 | **Nombre de frontrunners dans le champ** — > 3 frontrunners = avantage aux closers | Allure | `fieldPaceProfile(horses)` | Modéré |
| P36 | **Market steam** — cote baissée > 25% depuis ouverture = argent fort | Marché | `steamSignal(openingOdds, currentOdds)` | Fort |
| P37 | **Market drift** — cote montée > 20% = signal négatif | Marché | `driftSignal(openingOdds, currentOdds)` | Modéré |
| P38 | **Divergence win/place market** — place mieux côté que win = signe de régularité | Marché | `winPlaceDivergence(winOdds, placeOdds)` | Modéré |
| P39 | **Hippodrome préféré** — taux de victoire de ce cheval sur cette piste | Historique | `trackAffinityScore(horse, racecourse)` | Modéré |
| P40 | **Distance PB vs record de piste** — potentiel à battre son meilleur temps dans ces conditions | Vitesse | `timePotentialSignal(horse.PB, trackRecord)` | Modéré |
| P41 | **Ratio top3/courses** — cheval régulier vs aléatoire | Régularité | `consistencyRatio(horse.results)` | Modéré |
| P42 | **Ratio gains/start** — efficacité des gains (qualité vs quantité) | Gains | `earningsPerStartSignal(earnings, starts)` | Modéré |
| P43 | **Gains récents < 12 mois** — pondérer les gains récents × 1.5 vs gains anciens | Gains | `recentEarningsWeight(horse.results)` | Modéré |
| P44 | **Pedigree going** — ascendance sire/dam affectionnant terrain lourd ou léger | Pedigree | `pedigreeGoingAffinity(sire, dam, going)` | Faible |
| P45 | **Head-to-head principaux rivaux** — historique des confrontations directes | H2H | `headToHeadScore(horse, rivals, results)` | Modéré |
| P46 | **Signal saison** — forme au même mois de l'année précédente | Saisonnier | `seasonalFormSignal(horse, currentMonth)` | Faible |
| P47 | **Taille du champ** — < 8 partants : favoris surperforment ; > 14 : outsiders ont plus de chance | Champ | `fieldSizeAdjustment(fieldSize, discipline)` | Modéré |
| P48 | **Kilométrage saison plat** — > 18 courses depuis janvier = fatigue légère | Fatigue | `seasonMileageSignal(horse.startCount, discipline)` | Modéré |
| P49 | **Score composite going × distance × jockey × trainer** — combinaison des 4 facteurs clés | Composite | `platCompositeSignal(going, dist, jockey, trainer)` | Fort |
| P50 | **Calibration Plat-specific** — poids de signaux recalibrés sur données historiques Plat uniquement (KZ, musique, edge) | Calibration | Separate weight vector `PLAT_WEIGHTS` | Critique |

---

## 5. Spécifications — 50 Améliorations TROT

Le Trot est la discipline la plus **mathématisable** du sport hippique. La réduction kilométrique est un indicateur de performance objectif, la musique contient des codes spécifiques (DQ, abandon) et le driver joue un rôle encore plus central que le jockey en Plat. Le marché est moins efficient, ce qui crée davantage de valeur exploitable.

### 5.1 Contexte Technique

- Sous-disciplines : Attelé, Monté
- Distances : 1600m, 2100m, 2650m, 2875m (valeurs typiques)
- Départs : Autostart (derrière la voiture), Volté-départ (élan), Haie de départ
- Terrain : Sablon (sable), Herbe, Synthétique, Terre battue
- Indicateur central : Réduction kilométrique (RK) = temps/km en minutes

### 5.2 Codes Musique Trot

| Code | Signification |
|------|--------------|
| 1–9 | Position à l'arrivée |
| 0 | Disqualifié (DQ) — violation d'allure, saut de piste, incident |
| D | Disqualifié (variante écrite) |
| A | Arrêté / Abandonné |
| T | Tombé (driver/cheval) |
| P | Pulled up (arrêté délibérément, rare en trot) |

### 5.3 Les 50 Améliorations

| # | Amélioration | Famille | Implémentation | Impact |
|---|-------------|---------|----------------|--------|
| T01 | **Routing trot** — algorithme indépendant `trotPredictionScore()` avec `TROT_WEIGHTS` | Architecture | Separate function + weight vector | Critique |
| T02 | **Détection DQ (0) dans musique** — 0 ≠ position 10, 0 = disqualification = pénalité spécifique | Musique | `parseTrotMusic(music)` → detect `0` | Critique |
| T03 | **Détection codes A/T/D** — abandon, tombé, disqualifié dans la musique textuelle | Musique | Extended music parser for `A`, `T`, `D` | Critique |
| T04 | **DQ récent (< 3 courses)** — forte pénalité : risque de récidive structurelle | Musique | `recentDQPenalty(music, windowSize=3)` | Fort |
| T05 | **Musique filtrée (hors DQ)** — score de forme calculé en excluant les 0 et DQ | Musique | `musicScoreExcludingDQ(music)` | Fort |
| T06 | **Réduction kilométrique comme signal primaire** — RK est l'équivalent du temps absolu en plat | RK | `reductionKmSignal(reductionKm)` | Critique |
| T07 | **Progression RK sur 3 courses** — tendance de la réduction km sur les 3 dernières courses | RK | `rkProgressionSignal(lastThreeRK)` | Fort |
| T08 | **Variance RK** — régularité de la réduction (faible variance = fiable) | RK | `rkVarianceSignal(rkHistory)` | Fort |
| T09 | **RK vs moyenne du champ** — performance relative de la réduction km | RK | `rkVsFieldSignal(horse.reductionKm, fieldAvgRk)` | Fort |
| T10 | **Potentiel de record** — RK personnel vs record de la piste dans ces conditions | RK | `rkRecordPotential(horse.PBrk, trackRecord, going)` | Modéré |
| T11 | **Score driver 7 jours** — taux de victoire du driver (pas jockey) sur 7 derniers jours | Driver | `driverForm7d(horse.jockey, trotResults)` | Fort |
| T12 | **Score driver 30 jours** — taux driver sur 30 jours | Driver | `driverForm30d(horse.jockey, trotResults)` | Fort |
| T13 | **Score driver hippodrome** — certains drivers excellent sur Vincennes vs Enghien | Driver | `driverTrackRecord(horse.jockey, racecourse)` | Fort |
| T14 | **Partenariat driver-cheval** — historique des courses ensemble | Driver | `driverHorsePartnership(driver, horse)` | Fort |
| T15 | **Changement de driver (top driver)** — remplacement par un driver de référence | Driver | `driverChangeSignal(prev, current, topDrivers)` | Fort |
| T16 | **Récupération du driver attitré** — retour du driver habituel après remplacement | Driver | `regularDriverReturn(horse, driver, history)` | Modéré |
| T17 | **Score entraîneur trot** — strike rate entraîneur en trot uniquement | Trainer | `trainerTrotRate(trainer, trotResults)` | Modéré |
| T18 | **Duo entraîneur-driver** — taux de succès du binôme | Trainer | `trainerDriverDuoRate(trainer, driver)` | Modéré |
| T19 | **Autostart vs volté-départ** — performances différentes selon type de départ | Départ | `startTypeSignal(startType, horse.startHistory)` | Fort |
| T20 | **Numéro de corde < 2100m** — corde intérieure = avantage significatif sur distances courtes | Position | `innerRailSignal(number, distance)` | Fort |
| T21 | **Position extérieure + grand champ** — forte pénalité pour les extérieurs en champ > 12 | Position | `outerRailPenalty(number, fieldSize, distance)` | Fort |
| T22 | **Spécialisation distance 1600m** — profil sprinter trot | Distance | `trotDistanceProfile(horse, "1600")` | Fort |
| T23 | **Spécialisation distance 2100m** — profil moyen fond trot | Distance | `trotDistanceProfile(horse, "2100")` | Fort |
| T24 | **Spécialisation distance ≥ 2700m** — profil stayer trot | Distance | `trotDistanceProfile(horse, "2700+")` | Fort |
| T25 | **Musique filtrée par distance** — performances sur distances ±200m uniquement | Musique | `musicOnDistance(music, raceDistance, 200)` | Fort |
| T26 | **Surface spécifique** — sablon vs herbe vs synthétique | Terrain | `surfaceSignal(horse.surfaceHistory, currentSurface)` | Fort |
| T27 | **Going trot** — lourd = avantage aux réguliers, terrain ferme = avantage aux rapides | Terrain | `trotGoingSignal(horse, going, surface)` | Modéré |
| T28 | **Hippodrome spécifique trot** — Vincennes, Enghien, Paris-Vincennes international | Hippodrome | `trotTrackAffinitySignal(horse, racecourse)` | Fort |
| T29 | **Handicap métrique** — certaines courses accordent des mètres d'avance | Handicap | `metricHandicapSignal(horse.handicapMeters)` | Fort |
| T30 | **Attelé vs Monté** — sous-disciplines très différentes en termes de profil | Sous-discipline | `trotSubDisciplineMatch(horse.history, raceType)` | Critique |
| T31 | **Fraîcheur optimale trot** — 10–21 jours = optimal, < 8j = trop frais, > 35j = rouillé | Fraîcheur | `freshnessSignal(daysSince, "TROT")` | Fort |
| T32 | **Kilométrage cumulé saison** — > 25 courses depuis début d'année = fatigue | Fatigue | `seasonKmSignal(horse.startCount, season)` | Modéré |
| T33 | **Âge optimal trot** — 4–9 ans optimal (maturité plus lente qu'en Plat) | Âge | `ageSignalTrot(age)` avec courbe décalée | Modéré |
| T34 | **Courbe de maturité trot** — progression lente des 4 à 7 ans = fenêtre d'exploitabilité | Âge | `trotMaturityCurve(age, yearsProfessional)` | Modéré |
| T35 | **Score de régularité globale** — ratio (courses finies sans DQ / courses partantes) | Régularité | `trotRegularityScore(horse.results)` | Fort |
| T36 | **Pattern DQ structurel vs aléatoire** — cheval avec > 3 DQ en 20 courses = risque structurel | DQ Risk | `dqRiskProfile(horse.results)` | Fort |
| T37 | **Descente de classe trot** — très fort signal en trot (marché moins efficient = plus exploitable) | Classe | `trotClassDropSignal(currentClass, previousClass)` | Fort |
| T38 | **Qualité adversaires (RK comparée)** — RK actuelle vs RK moyenne du champ | Classe | `rkFieldCompetitivenessSignal(horse, field)` | Fort |
| T39 | **Signal de rebond post-DQ** — cheval DQ la fois d'avant souvent plus motivé et bien préparé | Rebond | `postDQReboundSignal(music, lastRace)` | Modéré |
| T40 | **Début de saison trot** — ramp-up janvier–mars : pondérer différemment les 2–3 premières courses | Saison | `trotSeasonStartSignal(raceDate, horse.starts)` | Modéré |
| T41 | **Market trot** — marché moins efficient = overlays plus fréquents, edge moyen plus élevé | Marché | Adjust market weight `TROT_MARKET_FACTOR` | Fort |
| T42 | **Surplus de sorties** — > 4 courses en 2 mois = signal de fatigue physique | Fatigue | `overraceSignal(recentStartCount, dayWindow=60)` | Modéré |
| T43 | **Style de course en trot** — mène souvent = frontrunner trot = avantage corde | Style | `trotRaceStyleSignal(horse.musicPositions)` | Modéré |
| T44 | **Record personnel exact vs conditions actuelles** — potentiel de PB dans ces conditions | RK | `trotPBPotentialSignal(horse, race)` | Modéré |
| T45 | **Pedigree trot** — ascendance trot pur vs mixte | Pedigree | `trotPedigreeSignal(sire, dam)` | Faible |
| T46 | **Score de constance RK** — écart-type de la RK sur saison | RK | `rkStdDevSignal(horse.rkHistory)` | Fort |
| T47 | **Forme comparée au champ** — positions normalisées par niveau de course | Forme | `normalizedMusicVsField(horse, field, raceDb)` | Modéré |
| T48 | **Première fois sur distance** — cheval jamais couru à cette distance = incertitude | Distance | `firstTimeOnDistanceSignal(horse, raceDistance)` | Modéré |
| T49 | **Signal retour victoire** — cheval qui a gagné il y a 1–2 courses peut récidiver | Forme | `recentWinRepeatSignal(music, windowSize=2)` | Modéré |
| T50 | **Composite trot** — score pondéré : RK × régularité × driver × hippodrome × distance | Composite | `trotCompositeSignal(rk, reg, driver, track, dist)` | Critique |

---

## 6. Spécifications — 50 Améliorations OBSTACLE

L'Obstacle est la discipline la plus **physique et la plus aléatoire**. Une chute ou un refus peut éliminer le meilleur cheval du monde. La robustesse, l'expérience sur les obstacles, la condition physique et l'adéquation au going lourd dominent. Les saisons hivernales sont fondamentales : les chevaux d'obstacle ont souvent des profils saisonniers très marqués.

### 6.1 Contexte Technique

- Sous-disciplines : Haies (hurdles), Steeple-chase, Cross-country
- Distances : 2400m à 6000m+
- Terrain : Dominant Lourd à Très Lourd
- Saison : Octobre à avril (pic hivernel)
- Poids : Fixe ou handicap selon course

### 6.2 Codes Spéciaux Musique Obstacle

| Code | Signification |
|------|--------------|
| F | Tombé (Fallen) |
| U | Désarçonné (Unseated) |
| R | Refus d'obstacle (Refused) |
| P | Arrêté délibérément (Pulled Up) |
| BD | Knock-down à l'obstacle |
| UR | Désarçonné avant obstacle |
| CO | Course eliminée / carried out |

### 6.3 Les 50 Améliorations

| # | Amélioration | Famille | Implémentation | Impact |
|---|-------------|---------|----------------|--------|
| O01 | **Routing obstacle** — algorithme indépendant `obstaclePredictionScore()` avec `OBSTACLE_WEIGHTS` | Architecture | Separate function + weight vector | Critique |
| O02 | **Sous-discipline** — Haies / Steeple-chase / Cross = trois algos ou trois jeux de poids | Sous-discipline | `OBSTACLE_WEIGHTS["haies"]` / `["steeple"]` / `["cross"]` | Critique |
| O03 | **Détection chutes (F/U/BD)** dans musique — fort signal négatif | Musique | `obstacleCodeParser(music)` → detect `F`, `U`, `BD` | Critique |
| O04 | **Détection refus (R/CO)** dans musique — risque structurel de refus | Musique | Detect `R`, `CO` in music | Critique |
| O05 | **Détection Pulled Up (P)** — arrêt délibéré = souvent problème physique | Musique | Detect `P` in music, distinguish tactical vs injury | Fort |
| O06 | **Score de chutes récentes** — pondération : F dans les 3 dernières courses = pénalité lourde | Sécurité | `recentFallPenalty(music, windowSize=3)` | Fort |
| O07 | **Pattern de refus** — cheval avec 2+ refus sur haies = risque structurel | Sécurité | `refusalRiskProfile(music)` | Fort |
| O08 | **Score de saut propre** — courses complétées sans incident sur obstacles | Sécurité | `cleanJumpScore(music)` | Fort |
| O09 | **Expérience obstacle** — nombre de courses d'obstacle complétées | Expérience | `jumpExperienceSignal(horse.jumpRaces)` | Fort |
| O10 | **Conversion Plat → Haies** — premier départ en obstacle = signal incertitude + potentiel | Conversion | `flatToJumpsConversionSignal(horse.history)` | Fort |
| O11 | **Conversion Haies → Steeple** — passage aux obstacles rigides = saut qualitatif | Conversion | `hurdlesToSteeplechaseSignal(horse.history)` | Fort |
| O12 | **Going lourd spécialiste** — cheval avec > 60% de ses bonnes performances sur lourd | Terrain | `heavyGoingSpecialistSignal(horse.goingHistory)` | Critique |
| O13 | **Going très lourd (TL)** — conditions extrêmes = ultra-sélectif, certains chevaux adorent | Terrain | `veryHeavyGoingSignal(horse, going="TL")` | Fort |
| O14 | **Going match obstacle** — croiser going actuel avec going des meilleures performances | Terrain | `obstacleGoingMatchSignal(horse, currentGoing)` | Fort |
| O15 | **Distance optimale obstacle** — 2400–3200m vs 3200–4500m = profils stayer très différents | Distance | `obstacleDistanceOptimum(horse, raceDistance)` | Fort |
| O16 | **Première fois à cette distance obstacle** — incertitude de distance = ajustement | Distance | `firstTimeObstacleDistance(horse, raceDistance)` | Modéré |
| O17 | **Jockey obstacle expérimenté** — taux de victoire en obstacle uniquement | Jockey | `jumpJockeyRating(horse.jockey, jumpResults)` | Fort |
| O18 | **Score jockey hippodrome obstacle** — certains jockeys excellent sur certains hippodromes saut | Jockey | `jumpJockeyTrackRecord(jockey, racecourse)` | Modéré |
| O19 | **Partenariat jockey-cheval sur obstacles** — courses ensemble en saut | Jockey | `jumpJockeyHorsePartnership(jockey, horse)` | Fort |
| O20 | **Changement de jockey en obstacle** — signal négatif fort (connaissance de l'obstacle = critique) | Jockey | `jumpJockeyChangeSignal(prev, current)` | Fort |
| O21 | **Entraîneur spécialiste obstacle** — taux de victoire obstacle uniquement | Trainer | `jumpTrainerRate(trainer, jumpResults)` | Fort |
| O22 | **Entraîneur hippodrome obstacle** — spécialisation piste en saut | Trainer | `jumpTrainerTrackRecord(trainer, racecourse)` | Modéré |
| O23 | **Taux entraîneur retour longue absence** — spécialiste du retour de blessure | Trainer | `jumpTrainerReturnRate(trainer)` | Modéré |
| O24 | **Âge optimal obstacle** — 6–9 ans généralement, 5 ans = trop jeune, > 11 ans = usure | Âge | `ageSignalObstacle(age)` | Fort |
| O25 | **Âge × Expérience obstacle** — combinaison âge et nombre de courses saut | Âge | `ageExperienceObstacleSignal(age, jumpRaces)` | Fort |
| O26 | **Forme hivernale** — octobre à mars = pic de forme obstacle, pénalité hors saison | Saison | `winterFormSignal(raceMonth, horse.monthForm)` | Fort |
| O27 | **Forme de début de saison** — première course de la saison obstacle = calibrage | Saison | `seasonOpeningSignal(horse.lastObstacleRace)` | Modéré |
| O28 | **Poids porté** — obstacle handicap : chaque kg compte davantage que sur le plat | Poids | `obstacleWeightSignal(weight, previousWeight)` | Fort |
| O29 | **Allègement de poids en obstacle** — réduction de poids = avantage physique amplifié | Poids | `obstacleWeightDropSignal(delta)` | Fort |
| O30 | **Longue absence (> 90 jours)** — retour physique = risque, sauf si entraîneur fiable | Fraîcheur | `longAbsenceSignal(daysSince, trainerReturnRate)` | Fort |
| O31 | **Absence calculée** — pause de 60–90 jours préparée intentionnellement = signal positif | Fraîcheur | `deliberateRestSignal(daysSince, targetRace)` | Modéré |
| O32 | **Fraîcheur optimale obstacle** — 21–35 jours entre courses = zone idéale | Fraîcheur | `freshnessSignal(daysSince, "OBSTACLE")` | Fort |
| O33 | **Surexploitation** — > 3 courses en 6 semaines en obstacle = risque physique | Fatigue | `jumpOverraceSignal(recentStarts, dayWindow=42)` | Fort |
| O34 | **Rebond post-chute** — cheval tombé mais indemne = souvent rebond net à la course suivante | Rebond | `fallReboundSignal(music, lastRace)` | Modéré |
| O35 | **Recovery post Pulled Up** — cheval arrêté intentionnellement = souvent ménagé pour cette course | Rebond | `pulledUpRecoverySignal(music, trainerPattern)` | Modéré |
| O36 | **Vainqueur précédent sur ce parcours** — a déjà gagné sur cet hippodrome en obstacle | Historique | `courseWinnerSignal(horse, racecourse, discipline)` | Fort |
| O37 | **Hippodrome spécifique obstacle** — Auteuil, Compiegne, Pau, Lyon, Strasbourg | Hippodrome | `jumpTrackAffinitySignal(horse, racecourse)` | Fort |
| O38 | **Profil du tracé** — parcours montagneux vs vallonné vs plat : certains chevaux s'y adaptent | Parcours | `trackProfileSignal(horse.style, courseProfile)` | Modéré |
| O39 | **Type d'obstacle** — rivière, double-oxer, haie basse, steeple rigide = expériences différentes | Obstacle Type | `obstacleTypeCompatibilitySignal(horse, raceType)` | Modéré |
| O40 | **Taille du champ obstacle** — > 15 partants = risque de chutes par domino | Champ | `jumpFieldRiskSignal(fieldSize)` | Modéré |
| O41 | **Qualité des adversaires battus en obstacle** — force du champ dans les courses précédentes | Classe | `jumpBeatenQualityScore(horse, raceDb)` | Fort |
| O42 | **Descente de classe obstacle** — encore plus exploitable car marché moins efficient | Classe | `jumpClassDropSignal(currentClass, previousClass)` | Fort |
| O43 | **Pedigree obstacle (NH)** — ascendance National Hunt spécialisée | Pedigree | `jumpPedigreeSignal(sire, dam)` | Modéré |
| O44 | **Pedigree staying blood** — ascendance stayer = avantage fond obstacle | Pedigree | `stayingBloodSignal(sire, dam, distance)` | Modéré |
| O45 | **Market obstacle** — marché obstacle = peu liquide, overlays fréquents et exploitables | Marché | Adjust market weight `OBSTACLE_MARKET_FACTOR` | Fort |
| O46 | **Vent et pluie** — impact sur obstacle plus fort que sur tout autre discipline | Météo | `jumpWeatherImpactSignal(wind, rain, going)` | Modéré |
| O47 | **Détérioration going en journée** — going peut passer de Bon à Lourd en une matinée de pluie | Météo | `goingDeteriorationSignal(morningGoing, actualGoing)` | Fort |
| O48 | **Breeding flat → obstacle** — un ex-cheval de Plat converti avec talent = potentiel non saturé | Conversion | `flatBreedingJumpSignal(horse.flatHistory, jumpHistory)` | Modéré |
| O49 | **Score robustesse composite** — Âge (6–9) × sans chute récente × régularité des finitions | Robustesse | `jumpRobustnessScore(age, fallHistory, completions)` | Critique |
| O50 | **Composite obstacle** — going match × expérience saut × jockey spécialiste × distance optimale | Composite | `obstacleCompositeSignal(going, exp, jockey, dist)` | Critique |

---

## 7. Nouveaux Types Requis

```typescript
// Extension de RaceContext
type RaceContext = Partial<Pick<RaceAnalysis, 
  | "marketVolatility" 
  | "modelConsensus" 
  | "raceQualityScore" 
  | "riskLevel"
  | "discipline"       // NOUVEAU
  | "going"            // NOUVEAU
  | "distance"         // NOUVEAU
  | "weather"          // NOUVEAU
  | "specialty"        // NOUVEAU
>>;

// Signal de terrain enrichi
type GoingSignal = {
  code: "TB" | "B" | "BL" | "BS" | "S" | "L" | "TL";
  horsePreference: number;   // -1 à +1
  fieldImpact: number;       // -1 à +1
};

// Profil jockey/driver
type RidingProfile = {
  name: string;
  winRate7d: number;
  winRate30d: number;
  winRateSeason: number;
  trackRate: number;
  partnershipRate: number;
  isChange: boolean;
};

// Signal musique obstacle enrichi
type ObtstacleMusicProfile = {
  falls: number;
  unseated: number;
  refused: number;
  pulledUp: number;
  cleanRaces: number;
  completionRate: number;
  score: number;
};

// Signal musique trot enrichi
type TrotMusicProfile = {
  disqualifications: number;
  abandonments: number;
  recentDQ: boolean;
  rkHistory: number[];
  rkMean: number;
  rkTrend: number;
  regularityScore: number;
  score: number;
};
```

---

## 8. Plan d'Implémentation

### Phase 1 — Fondations (Sprint 1 — 3 jours)

1. Étendre `RaceContext` avec `discipline`, `going`, `distance`, `weather`
2. Créer `musicParserTrot()` — détection DQ, abandons, RK parsing
3. Créer `musicParserObstacle()` — détection F, U, R, P, BD
4. Ajouter `PLAT_WEIGHTS`, `TROT_WEIGHTS`, `OBSTACLE_WEIGHTS` (3 vecteurs de poids)
5. Créer `routeToAlgorithm(discipline)` dans `prediction-math.ts`

### Phase 2 — Algorithme Plat (Sprint 2 — 4 jours)

1. Implémenter P01–P10 (routing, partant, going, distance, profil, jockey)
2. Implémenter P11–P20 (trainer, poids, équipement, musique)
3. Implémenter P21–P35 (forme, fraîcheur, allure, marché)
4. Implémenter P36–P50 (historique, classe, composite)

### Phase 3 — Algorithme Trot (Sprint 3 — 4 jours)

1. Implémenter T01–T10 (routing, musique trot, RK)
2. Implémenter T11–T25 (driver, entraîneur, départ, distance)
3. Implémenter T26–T40 (surface, hippodrome, handicap, fraîcheur)
4. Implémenter T41–T50 (marché, composite)

### Phase 4 — Algorithme Obstacle (Sprint 4 — 4 jours)

1. Implémenter O01–O12 (routing, sous-discipline, chutes, going)
2. Implémenter O13–O28 (distance, jockey, trainer, âge, saison)
3. Implémenter O29–O42 (poids, fraîcheur, rebond, classe)
4. Implémenter O43–O50 (pedigree, météo, composite)

### Phase 5 — Calibration (Sprint 5 — 3 jours)

1. Backtesting sur données historiques PMU 2024–2025
2. Recalibration des poids par discipline via `model_calibrations`
3. Validation temporelle (split 2024/2025)
4. Métriques : Brier Score, ROI simulé, top3 hit rate par discipline

---

## 9. Métriques de Succès

| Métrique | Baseline actuel | Cible post-refonte |
|----------|----------------|-------------------|
| Winner hit rate Plat | ~28% | ≥ 36% |
| Top3 hit rate Plat | ~52% | ≥ 62% |
| Winner hit rate Trot | ~22% | ≥ 32% |
| Top3 hit rate Trot | ~48% | ≥ 58% |
| Winner hit rate Obstacle | ~20% | ≥ 30% |
| Top3 hit rate Obstacle | ~44% | ≥ 56% |
| ROI simulé Value bets | ~−3% | ≥ +8% |
| Brier Score global | 0.22 | ≤ 0.17 |

---

## 10. Dépendances

- Extension schema DB : colonnes `going_preference`, `jump_experience`, `driver_id`, `fall_count`, `rk_history`
- API PMU enrichie : récupération driver, réduction km historique, codes obstacle musique
- Pipeline d'enrichissement : `jockey_stats`, `trainer_stats` pré-calculés en batch quotidien
- Table `odds_snapshots` : déjà présente, utiliser pour market steam/drift

---

*Ce document constitue la spécification complète de la PR-001. Toute implémentation partielle doit conserver la compatibilité avec l'interface actuelle `explainPredictionScore()` pendant la migration.*
