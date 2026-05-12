import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lexique turf | Kayzen Pronostic",
  description: "Tous les termes du turf expliqués : KZ Score, value bet, Kelly criterion, Quinté+, PMU, arrivée, cote, mise…",
};

const GLOSSARY: Array<{ term: string; definition: string; category: string }> = [
  /* Paris */
  { category: "Paris", term: "Simple Gagnant", definition: "Pari sur un cheval pour finir premier. Le plus simple et le plus liquide. Edge calculé sur prob. gagnant × cote − 1." },
  { category: "Paris", term: "Simple Placé", definition: "Pari sur un cheval pour finir dans les 3 premiers (2 premiers si ≤ 4 partants). Cote réduite, risque plus faible." },
  { category: "Paris", term: "Couple Gagnant", definition: "Désigner les 2 premiers dans l'ordre exact. Combinaison n × (n−1) tickets possibles." },
  { category: "Paris", term: "Couple Placé", definition: "Désigner 2 chevaux parmi les 3 premiers sans ordre imposé." },
  { category: "Paris", term: "Tiercé", definition: "Désigner les 3 premiers dans l'ordre exact. En désordre : rapport réduit." },
  { category: "Paris", term: "Quarté+", definition: "Désigner les 4 premiers dans l'ordre exact. Paris hippique emblématique du quotidien." },
  { category: "Paris", term: "Quinté+", definition: "Course phare PMU. Désigner les 5 premiers dans l'ordre exact. Rapport élevé, jackpot si non trouvé. Mise minimum 1,50 €." },
  { category: "Paris", term: "Pick 5", definition: "Sélectionner le gagnant de 5 courses consécutives. Pari sportif de précision." },
  { category: "Paris", term: "Multi", definition: "Pari combinatoire sur 4 à 8 chevaux dans les 4 premiers. Flexi possible pour réduire la mise." },
  { category: "Paris", term: "Flexi", definition: "Option permettant de parier une fraction du ticket de base (ex : 25%). Réduit la mise, réduit proportionnellement le rapport." },
  /* Algorithme */
  { category: "Algorithme", term: "KZ Score", definition: "Score composite Kayzen de 0 à 99. Combine probabilité gagnant, probabilité Top 3, edge marché, stabilité des rangs par Monte Carlo et niveau de confiance." },
  { category: "Algorithme", term: "Value Bet", definition: "Pari à valeur positive : la probabilité estimée dépasse la probabilité implicite de la cote. Edge > 10% = signal fort." },
  { category: "Algorithme", term: "Edge marché", definition: "Écart en % entre la probabilité du modèle et la probabilité implicite du marché. Positif = sous-évaluation, négatif = surcote." },
  { category: "Algorithme", term: "Kelly Criterion", definition: "Formule mathématique donnant la fraction optimale de bankroll à miser : f = (bp − q) / b. Kayzen utilise Kelly fractionné (50%) pour limiter la variance." },
  { category: "Algorithme", term: "Plackett-Luce", definition: "Modèle probabiliste utilisé pour simuler des ordres d'arrivée complets. Kayzen réalise 2 000 tirages Monte Carlo (Gumbel-max trick) pour estimer les probabilités Top 1/3/5." },
  { category: "Algorithme", term: "Monte Carlo", definition: "Technique de simulation stochastique : on génère de nombreux scénarios aléatoires pour estimer une distribution de probabilités." },
  { category: "Algorithme", term: "Softmax / température", definition: "La température T contrôle l'étalement de la distribution. T élevée = probabilités plus uniformes (course ouverte). T faible = favori très dominant." },
  { category: "Algorithme", term: "Modèle de confiance", definition: "Score 0-99 mesurant la convergence des signaux sur un ticket. 70+ = plusieurs signaux concordants." },
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
  { category: "Bankroll", term: "Drawdown", definition: "Perte maximale consécutive depuis un pic de bankroll. Kayzen ajuste les mises en cas de drawdown élevé pour protéger le capital." },
  { category: "Bankroll", term: "Kelly fractionné", definition: "Variante du Kelly Criterion utilisant 50% de la mise recommandée. Réduit la variance tout en conservant l'avantage mathématique." },
  { category: "Bankroll", term: "Valeur espérée (EV)", definition: "Espérance de gain par unité misée. EV = (prob. victoire × gain net) − (prob. défaite × mise). EV > 0 = pari rentable à long terme." },
];

const categories = Array.from(new Set(GLOSSARY.map((g) => g.category)));

export default function LexiquePage() {
  return (
    <main className="min-h-screen bg-bg pb-20">
      <div className="mx-auto max-w-4xl px-4 pt-6 sm:px-6 lg:px-8">

        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm font-medium text-muted shadow-sm transition hover:border-accent hover:text-accent-text"
        >
          <ArrowLeft size={14} /> Accueil
        </Link>

        <div className="mb-8 flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent-lo">
            <BookOpen size={26} className="text-accent-text" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted">Kayzen Pronostic</p>
            <h1 className="font-display text-3xl font-bold text-fg">Lexique turf</h1>
            <p className="mt-1 text-sm text-muted">Tous les termes indispensables pour comprendre nos analyses et pronostics.</p>
          </div>
        </div>

        <div className="grid gap-8">
          {categories.map((cat) => (
            <section key={cat} aria-labelledby={`cat-${cat}`}>
              <h2 id={`cat-${cat}`} className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted">
                <span className="h-px flex-1 bg-border" />
                {cat}
                <span className="h-px flex-1 bg-border" />
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {GLOSSARY.filter((g) => g.category === cat).map(({ term, definition }) => (
                  <article key={term} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                    <h3 className="font-semibold text-fg">{term}</h3>
                    <p className="mt-1.5 text-sm leading-6 text-muted">{definition}</p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-surface-sub p-5 text-center">
          <p className="text-sm text-muted">
            Un terme manque ?{" "}
            <Link href="/contact" className="font-semibold text-accent-text hover:text-accent">
              Contactez-nous
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
