/**
 * LEXIQUE — une seule source pour la page /lexique et les infobulles des
 * termes techniques (composant `Term` de la page course).
 *
 * Les définitions vivaient dans la page : une infobulle qui les aurait
 * recopiées aurait fini par dire autre chose que le lexique.
 */

import { FLOW_WINDOW_MIN, MVT_NOISE_PCT, STRONG_MONEY_PTS } from "@/lib/market";

export type GlossaryEntry = { term: string; definition: string; category: string };

export const GLOSSARY = [
  /* Paris */
  { category: "Paris", term: "Simple Gagnant", definition: "Pari sur un cheval pour finir premier. Le plus simple et le plus liquide. Edge calculé sur prob. gagnant × cote − 1." },
  { category: "Paris", term: "Simple Placé", definition: "Pari sur un cheval pour finir dans les 3 premiers (2 premiers si ≤ 4 partants). Cote réduite, risque plus faible." },
  { category: "Paris", term: "Couplé gagnant", definition: "Désigner les 2 premiers dans l'ordre exact. Combinaison n × (n−1) tickets possibles." },
  { category: "Paris", term: "Couplé placé", definition: "Désigner 2 chevaux parmi les 3 premiers sans ordre imposé." },
  { category: "Paris", term: "Tiercé", definition: "Désigner les 3 premiers dans l'ordre exact. En désordre : rapport réduit." },
  { category: "Paris", term: "Quarté+", definition: "Désigner les 4 premiers dans l'ordre exact. Paris hippique emblématique du quotidien." },
  { category: "Paris", term: "Quinté+", definition: "Course phare PMU. Désigner les 5 premiers dans l'ordre exact. Rapport élevé, jackpot si non trouvé. Mise minimum 1,50 €." },
  { category: "Paris", term: "Pick 5", definition: "Sélectionner le gagnant de 5 courses consécutives. Pari sportif de précision." },
  { category: "Paris", term: "Multi", definition: "Pari combinatoire sur 4 à 8 chevaux dans les 4 premiers. Flexi possible pour réduire la mise." },
  { category: "Paris", term: "Flexi", definition: "Option permettant de parier une fraction du ticket de base (ex : 25%). Réduit la mise, réduit proportionnellement le rapport." },
  /* Algorithme */
  { category: "Algorithme", term: "IA (avis sans cote)", definition: "Probabilité de victoire estimée par le modèle fondamental de Kayzen Turf à partir de la forme, des gains et de l'entourage, sans jamais voir la cote. Comparée à la probabilité du marché, elle fait apparaître les désaccords (profils Caché, Value, À éviter). Voir la page Méthode." },
  { category: "Algorithme", term: "Value Bet", definition: "Pari à valeur positive : la probabilité estimée dépasse la probabilité implicite de la cote. Edge > 10% = signal fort." },
  { category: "Algorithme", term: "Edge marché", definition: "Écart en % entre la probabilité du modèle et la probabilité implicite du marché. Positif = sous-évaluation, négatif = surcote." },
  { category: "Algorithme", term: "Kelly Criterion", definition: "Formule mathématique donnant la fraction optimale de bankroll à miser : f = (bp − q) / b. Kayzen Turf utilise Kelly fractionné (50%) pour limiter la variance." },
  { category: "Algorithme", term: "Plackett-Luce", definition: "Modèle probabiliste utilisé pour simuler des ordres d'arrivée complets. Kayzen Turf réalise 2 000 tirages Monte Carlo (Gumbel-max trick) pour estimer les probabilités Top 1/3/5." },
  { category: "Algorithme", term: "Monte Carlo", definition: "Technique de simulation stochastique : on génère de nombreux scénarios aléatoires pour estimer une distribution de probabilités." },
  { category: "Algorithme", term: "Softmax / température", definition: "La température T contrôle l'étalement de la distribution. T élevée = probabilités plus uniformes (course ouverte). T faible = favori très dominant." },
  { category: "Algorithme", term: "Modèle de confiance", definition: "Probabilité estimée qu'un ticket passe, exprimée en %. Un Simple Placé à 70 a environ 7 chances sur 10 d'aboutir." },
  { category: "Algorithme", term: "Consensus modèle", definition: "% d'accord entre les simulations sur le cheval favori. >75% = favori très stable." },
  { category: "Algorithme", term: "Calibration probabiliste", definition: "Vérification que les probabilités estimées correspondent aux fréquences réelles. Un modèle bien calibré dit '30%' et gagne 30% du temps." },
  /* Turf général */
  { category: "Turf général", term: "PMU", definition: "Pari Mutuel Urbain — organisme français gérant les paris hippiques. Le rapport est calculé sur la masse des paris réels (pool), pas par une cote fixe." },
  { category: "Turf général", term: "Hippodrome", definition: "Piste de course. Chaque hippodrome a ses caractéristiques (longueur, virages, terrain) qui influencent les performances." },
  { category: "Turf général", term: "Réunion (R1, R2…)", definition: "Ensemble de courses organisées le même jour sur un même hippodrome. Plusieurs réunions peuvent coexister le même jour." },
  { category: "Turf général", term: "Course (C1, C2…)", definition: "Épreuve individuelle au sein d'une réunion. Identifiée par son numéro et son nom (prix)." },
  { category: "Turf général", term: "Partant", definition: "Cheval effectivement au départ d'une course. Un non-partant (NP) est retiré après la publication des programmes." },
  { category: "Turf général", term: "Musique", definition: "Historique des récentes performances d'un cheval : chiffre = rang d'arrivée, D = disqualifié, A = arrêté, T = tombe." },
  { category: "Turf général", term: "Cote PMU", definition: "Rapport calculé en temps réel à partir des mises du pool. Fluctue jusqu'au départ. Cote définitive = cote de départ (official)." },
  { category: "Turf général", term: "Cote juste", definition: "Cote théorique correspondant à la probabilité estimée par le modèle : 1 / probabilité. Si le modèle donne 25%, la cote juste est 4.0." },
  { category: "Turf général", term: "Handicap", definition: "Course où les chevaux portent des poids différents pour équilibrer les chances. Plus le cheval a gagné, plus il porte de poids." },
  { category: "Turf général", term: "Distance (m)", definition: "Longueur de la course en mètres. Chaque cheval a une distance idéale selon son profil physiologique et son historique." },
  { category: "Turf général", term: "Terrain (sol)", definition: "État de la piste : souple, bon souple, bon, bon dur, dur. Certains chevaux ont une forte préférence de terrain." },
  { category: "Turf général", term: "Plat", definition: "Discipline : courses sans obstacles, à allure libre. Chevaux galopeurs." },
  { category: "Turf général", term: "Trot", definition: "Discipline : allure imposée (le trot). Le cheval doit trotter — une faute (galop) entraîne une disqualification ou une pénalité." },
  { category: "Turf général", term: "Obstacle", definition: "Discipline : courses avec haies ou steeplechase (obstacle solides). Chute possible, risque plus élevé." },
  { category: "Turf général", term: "Driver / Jockey", definition: "En Trot, le conducteur s'appelle driver (sulky). En Plat et Obstacle, c'est un jockey monté sur le cheval." },
  { category: "Turf général", term: "Autopartant vs Volte", definition: "En Trot : autopartant = départ voiture (derrière la voiture qui accélère). Volte = départ en ligne avec départ lancé." },
  { category: "Turf général", term: "Gains (€)", definition: "Total des gains en course remportés par un cheval au cours de sa carrière. Indicateur de niveau de compétition." },
  { category: "Turf général", term: "Bankroll", definition: "Capital total alloué aux paris. La gestion de bankroll (Kelly, mises fixes) détermine la survie à long terme du parieur." },
  { category: "Bankroll", term: "ROI (Return on Investment)", definition: "Rentabilité en % sur un historique de paris. ROI = (gains − mises) / mises × 100. Un ROI positif de 5% sur 100 paris est excellent en turf." },
  { category: "Bankroll", term: "Drawdown", definition: "Perte maximale consécutive depuis un pic de bankroll. Kayzen Turf ajuste les mises en cas de drawdown élevé pour protéger le capital." },
  { category: "Bankroll", term: "Kelly fractionné", definition: "Variante du Kelly Criterion utilisant 50% de la mise recommandée. Réduit la variance tout en conservant l'avantage mathématique." },
  { category: "Bankroll", term: "Valeur espérée (EV)", definition: "Espérance de gain par unité misée. EV = (prob. victoire × gain net) − (prob. défaite × mise). EV > 0 = pari rentable à long terme." },
  /* Marché */
  { category: "Marché", term: "Marge du PMU (devig)", definition: "Le PMU prélève une part des enjeux : les probabilités implicites des cotes additionnées dépassent 100 %. Retirer cette marge (« devig ») ramène la somme à 100 % et donne la probabilité du marché comparée à celle de l'IA." },
  { category: "Marché", term: "MVT", definition: `Mouvement de la cote depuis le premier relevé du jour. Une cote qui baisse signifie que le cheval est joué, une cote qui monte qu'il est délaissé ; sous ±${MVT_NOISE_PCT} %, la variation est tenue pour du bruit.` },
  { category: "Marché", term: "Argent entrant / sortant", definition: `Variation de la part du cheval dans le pool simple gagnant du PMU : +${STRONG_MONEY_PTS} points en ${FLOW_WINDOW_MIN} minutes pour l'argent entrant, −${STRONG_MONEY_PTS} points pour l'argent sortant. Le PMU ne publie pas qui mise.` },
  { category: "Marché", term: "Smart money", definition: "Argent qui entre (ou accélère), cote en baisse, alors que l'IA — qui ne voit jamais la cote — est favorable ou d'accord. C'est un argent que le modèle indépendant confirme, pas « l'argent des initiés ». Son rendement est mesuré au suivi de performance." },
  { category: "Marché", term: "Top 3", definition: "Probabilité estimée que le cheval termine dans les trois premiers, tirée de simulations d'arrivées complètes à partir des probabilités de victoire." },
] as const satisfies readonly GlossaryEntry[];

export type LexiqueTerm = (typeof GLOSSARY)[number]["term"];

/** Définition d'un terme du lexique, `null` s'il n'y figure pas. */
export function lexiqueDefinition(term: string): string | null {
  return GLOSSARY.find((g) => g.term === term)?.definition ?? null;
}
