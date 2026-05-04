import { Brain, GitBranch, LineChart, Network, ShieldCheck, Sparkles } from "lucide-react";

const techniques = [
  {
    icon: LineChart,
    title: "Modèles tabulaires",
    body: "Random Forest pour la robustesse baseline, Gradient Boosting type XGBoost/LightGBM pour capturer les interactions non lineaires : forme, distance, piste, gains, musique, jockey et entraîneur.",
  },
  {
    icon: Brain,
    title: "Deep learning",
    body: "MLP et modèles séquentiels pour exploiter les historiques de performances. Les séries récentes sont pondérées afin de distinguer forme réelle, irrégularité et contexte de course.",
  },
  {
    icon: Network,
    title: "Graphes relationnels",
    body: "Approche Graph Neural Network ciblee pour modeliser les relations cheval-jockey-entraîneur-hippodrome, utile lorsque les connexions historiques creent un avantage structurel.",
  },
  {
    icon: GitBranch,
    title: "Ensemble learning",
    body: "Fusion des scores de plusieurs modèles, calibration probabiliste et pénalités de risque. Le KZ Score combine probabilité gagnant, Top 3, Top 5, value index et niveau de confiance.",
  },
  {
    icon: Sparkles,
    title: "Value bet detector",
    body: "Comparaison entre probabilité estimée et cote implicite du marché. Une opportunité est marquée lorsque l'écart probabilité/cote reste positif après marge de securite.",
  },
  {
    icon: ShieldCheck,
    title: "Apprentissage après course",
    body: "Après les résultats, le système compare prediction et arrivée, analyse les écarts, stocke les erreurs et prepare le recalibrage des pondérations pour améliorer la stabilité.",
  },
];

export default function TechniquesPredictionPage() {
  return (
    <main className="min-h-screen bg-[#f3f5f4] px-3 py-12 text-[#26312e] sm:px-5 lg:px-8" id="contenu-principal">
      <section className="mx-auto max-w-[1240px]">
        <p className="text-sm font-bold uppercase text-emerald-700">Kayzen Pronostic Turf PMU</p>
        <h1 className="mt-2 text-3xl font-bold tracking-normal sm:text-5xl">Techniques de prediction utilisees</h1>
        <p className="mt-4 max-w-4xl text-base leading-7 text-[#52615d]">
          La plateforme combine des méthodes statistiques, machine learning et data engineering pour produire des pronostics probabilistes.
          Aucun modèle ne garantit un gain : l’objectif est de mieux quantifier l’incertitude et de rendre les décisions explicables.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {techniques.map(({ body, icon: Icon, title }) => (
            <article className="rounded-md border border-[#d9e1de] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl" key={title}>
              <div className="grid h-11 w-11 place-items-center rounded-sm bg-emerald-50 text-emerald-700">
                <Icon size={22} />
              </div>
              <h2 className="mt-4 text-xl font-bold">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-[#52615d]">{body}</p>
            </article>
          ))}
        </div>

        <section className="mt-8 rounded-md border border-[#d9e1de] bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-bold">Pipeline complet</h2>
          <ol className="mt-4 grid gap-3 text-sm leading-7 text-[#52615d] md:grid-cols-2">
            <li><strong>1. Collecte</strong> : courses, partants, performances, cotes, piste, météo, résultats.</li>
            <li><strong>2. Normalisation</strong> : nettoyage, matching chevaux/jockeys/entraîneurs, controle doublons.</li>
            <li><strong>3. Feature engineering</strong> : forme, regularite, aptitude distance, gains, specialite, value implicite.</li>
            <li><strong>4. Prediction</strong> : probabilités gagnant, Top 3, Top 5, KZ Score et niveau de confiance.</li>
            <li><strong>5. Recommandation</strong> : tickets proposés uniquement selon les paris ouverts sur la course.</li>
            <li><strong>6. Feedback loop</strong> : analyse après course, erreurs, recalibrage et surveillance du ROI.</li>
          </ol>
        </section>
      </section>
    </main>
  );
}
