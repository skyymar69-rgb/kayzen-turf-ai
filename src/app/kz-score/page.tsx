import Link from "next/link";
import { ArrowLeft, BarChart3, Brain, Gauge, Sparkles, TrendingUp, Zap } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Comment fonctionne le KZ Score | Kayzen Pronostic",
  description: "Explication complète du KZ Score : méthode de calcul, composantes (probabilité gagnant, value index, confiance), interprétation et limites.",
};

const COMPONENTS = [
  {
    icon: TrendingUp,
    label: "Probabilité gagnant",
    weight: "35%",
    color: "bg-violet-100 text-violet-800",
    desc: "Calculée par simulation Monte Carlo (2 000 tirages, modèle Plackett-Luce). Représente la fréquence avec laquelle le cheval finit premier dans les simulations.",
  },
  {
    icon: BarChart3,
    label: "Probabilité Top 3",
    weight: "25%",
    color: "bg-sky-100 text-sky-800",
    desc: "Probabilité de finir dans les 3 premiers. Pilier central des paris Tiercé, Trio et Quarté+. Pénalise les chevaux à probabilité gagnant haute mais instable.",
  },
  {
    icon: Zap,
    label: "Value Index (edge marché)",
    weight: "20%",
    color: "bg-amber-100 text-amber-800",
    desc: "Écart entre probabilité estimée et probabilité implicite du marché (1/cote). Positif = sous-évaluation. Edge > 10% = signal value fort. Négligeable si négatif.",
  },
  {
    icon: Gauge,
    label: "Stabilité des rangs",
    weight: "12%",
    color: "bg-green-100 text-green-800",
    desc: "Mesure la cohérence du rang prédit sur les 2 000 simulations. Un cheval finissant 1er dans 95% des tirages a une stabilité forte. Réduit la variance du score.",
  },
  {
    icon: Brain,
    label: "Niveau de confiance",
    weight: "8%",
    color: "bg-orange-100 text-orange-800",
    desc: "Synthèse qualitative : convergence de la forme récente, de l'analyse jockey-hippodrome et des facteurs contextuels. Faible / Moyenne / Forte.",
  },
];

const RANGES = [
  { min: 80, max: 99, label: "Excellence", desc: "Tous les signaux convergent. Base de tiercé / combiné. Mise confiance recommandée.", cls: "border-green-300 bg-green-50 text-green-800" },
  { min: 65, max: 79, label: "Solide",     desc: "Signal fort mais non unanime. Intégrer dans les tickets avec un outsider.", cls: "border-sky-300 bg-sky-50 text-sky-800" },
  { min: 50, max: 64, label: "Intéressant",desc: "Potentiel value si edge > 10%. À surveiller mais pas base unique.", cls: "border-amber-300 bg-amber-50 text-amber-800" },
  { min: 30, max: 49, label: "Faible",     desc: "Signal fragile. Éventuellement outsider dans un ticket large.", cls: "border-orange-300 bg-orange-50 text-orange-800" },
  { min: 0,  max: 29, label: "À éviter",   desc: "Trop d'incertitudes. Ne pas inclure dans les tickets structurés.", cls: "border-red-300 bg-red-50 text-red-800" },
];

export default function KzScorePage() {
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
            <Sparkles size={26} className="text-accent-text" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted">Méthodologie</p>
            <h1 className="font-display text-3xl font-bold text-fg">Comment fonctionne le KZ Score ?</h1>
            <p className="mt-1 text-sm text-muted">Score composite 0–99 calculé par simulation probabiliste sur l'ensemble des partants.</p>
          </div>
        </div>

        <div className="grid gap-6">

          {/* Définition */}
          <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="font-display text-xl font-bold text-fg mb-3">Qu'est-ce que le KZ Score ?</h2>
            <p className="text-sm leading-7 text-muted">
              Le <strong className="text-fg">KZ Score</strong> est un indicateur composite de 0 à 99 synthétisant la force prédictive d'un cheval pour une course donnée.
              Il n'est pas une probabilité brute — c'est une <em>note de confiance algorithmique</em> pondérant plusieurs signaux indépendants.
              Un cheval avec un KZ de 87 n'a pas 87% de chances de gagner : il cumule simplement des signaux particulièrement convergents.
            </p>
            <p className="mt-3 text-sm leading-7 text-muted">
              Le score est recalculé pour chaque course en tenant compte du contexte complet : taille du champ, discipline, distance, hippodrome, météo et historique des partants.
              Deux courses identiques avec les mêmes chevaux sur des hippodromes différents donneront des KZ différents.
            </p>
          </section>

          {/* Composantes */}
          <section>
            <h2 className="font-display text-xl font-bold text-fg mb-4">Les 5 composantes du score</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {COMPONENTS.map(({ icon: Icon, label, weight, color, desc }) => (
                <article key={label} className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-surface-sub">
                        <Icon size={18} className="text-accent-text" />
                      </div>
                      <h3 className="font-semibold text-fg">{label}</h3>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${color}`}>{weight}</span>
                  </div>
                  <p className="text-sm leading-6 text-muted">{desc}</p>
                </article>
              ))}
            </div>
          </section>

          {/* Grille d'interprétation */}
          <section>
            <h2 className="font-display text-xl font-bold text-fg mb-4">Grille d'interprétation</h2>
            <div className="grid gap-2">
              {RANGES.map(({ min, max, label, desc, cls }) => (
                <div key={label} className={`flex items-start gap-4 rounded-xl border p-4 ${cls}`}>
                  <span className="font-display text-2xl font-bold w-16 shrink-0 text-center">{min}–{max}</span>
                  <div>
                    <p className="font-bold">{label}</p>
                    <p className="mt-0.5 text-sm">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Limites */}
          <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="font-display text-xl font-bold text-fg mb-3">Limites et mises en garde</h2>
            <ul className="space-y-2 text-sm leading-6 text-muted">
              {[
                "Le KZ Score ne modélise pas les événements imprévus : chute, incident de course, perte de fer, boîterie.",
                "Les courses à faible nombre de partants (≤ 5) ont une variance de score plus élevée — interpréter avec prudence.",
                "Un KZ élevé ne compense pas une cote très basse : si la cote juste confirme le marché, l'edge reste nul.",
                "Le modèle est calibré sur des données PMU françaises — les courses internationales (AQPS, Arabes) peuvent dégrader la précision.",
                "Ne jamais miser uniquement sur le KZ Score. Croiser avec l'edge marché, la forme récente et le contexte de course.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* CTA */}
          <div className="flex flex-wrap gap-3">
            <Link href="/" className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white transition hover:bg-accent/90">
              Voir le programme du jour
            </Link>
            <Link href="/lexique" className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 text-sm font-bold text-fg transition hover:bg-surface-sub">
              Lexique turf complet
            </Link>
            <Link href="/techniques-prediction" className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 text-sm font-bold text-fg transition hover:bg-surface-sub">
              Méthodes de prédiction
            </Link>
          </div>

        </div>
      </div>
    </main>
  );
}
