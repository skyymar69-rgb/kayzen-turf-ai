import Link from "next/link";
import { ArrowRight, BarChart3, Brain, Check, Shield, Sparkles, Trophy, Zap } from "lucide-react";

export const metadata = {
  title: "Tarifs & Offres",
  description: "Découvrez les offres Kayzen Turf AI : accès gratuit, Starter, Premium et Pro. Analyses IA, value bets et tickets optimisés pour chaque profil de parieur.",
};

const PLANS = [
  {
    id: "gratuit",
    name: "Gratuit",
    price: null,
    period: null,
    tagline: "Commencez sans engagement",
    color: "border-border",
    badge: null,
    features: [
      "1 course analysée par jour",
      "Ordre probable des partants",
      "Score KZ et base IA",
      "Lecture marché simplifiée",
      "Jeu responsable & pédagogie",
    ],
    cta: "Commencer gratuitement",
    ctaHref: "/",
    ctaStyle: "border border-border bg-surface text-fg hover:border-accent hover:text-accent-text",
  },
  {
    id: "starter",
    name: "Starter",
    price: 19,
    period: "mois",
    tagline: "Pour débuter avec l'IA",
    color: "border-border",
    badge: null,
    features: [
      "3 courses analysées par jour",
      "Bases IA et alertes prioritaires",
      "Value bets détectés",
      "Tickets Couple et Trio",
      "Statistiques de base",
      "Support email",
    ],
    cta: "Démarrer Starter",
    ctaHref: "#contact",
    ctaStyle: "border border-accent text-accent-text hover:bg-accent hover:text-white",
  },
  {
    id: "premium",
    name: "Premium",
    price: 39,
    period: "mois",
    tagline: "L'expérience complète",
    color: "border-accent",
    badge: "Populaire",
    features: [
      "Accès complet toutes les courses",
      "Tickets intelligents (Quinte+, Quarté+, Pick5)",
      "Value bets et edge calculations",
      "3 modes de ticket (sécurisé/équilibré/agressif)",
      "Statistiques avancées et heatmaps",
      "Historique des prédictions",
      "Auto-analyse des résultats",
      "Support prioritaire",
    ],
    cta: "Démarrer Premium",
    ctaHref: "#contact",
    ctaStyle: "bg-accent text-white hover:bg-accent-hi",
  },
  {
    id: "pro",
    name: "Pro",
    price: 79,
    period: "mois",
    tagline: "Pour les stratèges avancés",
    color: "border-border",
    badge: null,
    features: [
      "Tout Premium inclus",
      "Stratégie bankroll personnalisée",
      "Backtesting sur données historiques",
      "Signaux experts et alertes SMS",
      "Accès API prioritaire",
      "Données brutes exportables",
      "Onboarding dédié",
      "SLA garanti",
    ],
    cta: "Contacter l'équipe",
    ctaHref: "#contact",
    ctaStyle: "border border-border bg-surface text-fg hover:border-accent hover:text-accent-text",
  },
] as const;

const COMPARISON_FEATURES = [
  { label: "Courses par jour",              gratuit: "1",     starter: "3",     premium: "Toutes",  pro: "Toutes" },
  { label: "Base IA et ordre probable",     gratuit: true,    starter: true,    premium: true,      pro: true     },
  { label: "Value bets",                    gratuit: false,   starter: true,    premium: true,      pro: true     },
  { label: "Tickets intelligents",          gratuit: false,   starter: "Partiel",premium: true,     pro: true     },
  { label: "Quinte+ / Quarté+ / Pick5",     gratuit: false,   starter: false,   premium: true,      pro: true     },
  { label: "Historique prédictions",        gratuit: false,   starter: false,   premium: true,      pro: true     },
  { label: "Auto-analyse résultats",        gratuit: false,   starter: false,   premium: true,      pro: true     },
  { label: "Backtesting",                   gratuit: false,   starter: false,   premium: false,     pro: true     },
  { label: "Accès API",                     gratuit: false,   starter: false,   premium: false,     pro: true     },
] as const;

export default function TarifsPage() {
  return (
    <main className="min-h-screen bg-bg pb-20" id="contenu-principal">
      <div className="mx-auto max-w-[1480px] px-4 pt-8 sm:px-6 lg:px-8">

        {/* Header */}
        <section className="mb-10 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-lo px-3 py-1 text-xs font-bold uppercase tracking-widest text-accent-text">
            <Sparkles size={11} />
            Offres SaaS
          </span>
          <h1 className="mt-4 font-display text-4xl font-bold text-fg sm:text-5xl">
            Monétiser la clarté,<br className="hidden sm:block" /> pas une promesse de gain
          </h1>
          <p className="mt-4 mx-auto max-w-2xl text-base leading-7 text-muted">
            Kayzen Turf AI est un outil d'aide à la décision. Nous vendons de l'analyse et de la transparence,
            pas des certitudes. Chaque offre correspond à un niveau d'engagement dans votre pratique du turf.
          </p>
        </section>

        {/* Pricing cards */}
        <section className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Plans tarifaires">
          {PLANS.map((plan) => (
            <article
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border-2 bg-surface p-6 shadow-sm ${plan.color} ${plan.badge ? "ring-2 ring-accent ring-offset-2 ring-offset-bg" : ""}`}
            >
              {plan.badge && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-accent px-4 py-1 text-xs font-bold text-white">
                  {plan.badge}
                </span>
              )}

              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted">{plan.name}</p>
                <div className="mt-2 flex items-baseline gap-1">
                  {plan.price ? (
                    <>
                      <span className="font-display text-4xl font-bold text-fg">{plan.price}</span>
                      <span className="text-sm text-muted">€/{plan.period}</span>
                    </>
                  ) : (
                    <span className="font-display text-4xl font-bold text-fg">Gratuit</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted">{plan.tagline}</p>
              </div>

              <ul className="mt-6 flex flex-1 flex-col gap-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-fg">
                    <Check size={15} className="mt-0.5 shrink-0 text-accent" />
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href={plan.ctaHref}
                className={`mt-8 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition ${plan.ctaStyle}`}
              >
                {plan.cta} <ArrowRight size={14} />
              </a>
            </article>
          ))}
        </section>

        {/* Tableau comparatif */}
        <section className="mb-12 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          <div className="border-b border-border px-6 py-5">
            <h2 className="font-display text-2xl font-bold text-fg">Comparatif détaillé</h2>
            <p className="mt-1 text-sm text-muted">Toutes les fonctionnalités selon votre offre.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <caption className="sr-only">Comparaison des fonctionnalités selon l'offre</caption>
              <thead>
                <tr className="border-b border-border bg-surface-sub text-xs font-bold uppercase tracking-widest text-muted">
                  <th className="px-6 py-4">Fonctionnalité</th>
                  {PLANS.map((p) => (
                    <th key={p.id} className={`px-4 py-4 text-center ${p.badge ? "text-accent-text" : ""}`}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {COMPARISON_FEATURES.map((row) => (
                  <tr key={row.label} className="hover:bg-surface-sub">
                    <td className="px-6 py-3.5 text-sm font-medium text-fg">{row.label}</td>
                    {(["gratuit", "starter", "premium", "pro"] as const).map((key) => {
                      const val = row[key];
                      return (
                        <td key={key} className="px-4 py-3.5 text-center">
                          {typeof val === "boolean" ? (
                            val
                              ? <Check size={16} className="mx-auto text-accent" />
                              : <span className="mx-auto block h-0.5 w-4 rounded bg-border-strong" />
                          ) : (
                            <span className={`text-sm font-semibold ${key === "premium" ? "text-accent-text" : "text-fg"}`}>{val}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Garanties */}
        <section className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Garanties">
          {[
            { icon: <Shield size={20} />,    title: "Pas de promesse de gain",  desc: "Nous vendons de l'analyse, pas des certitudes. La transparence est notre valeur principale." },
            { icon: <Brain size={20} />,     title: "IA auto-apprenante",       desc: "Chaque arrivée officielle recalibre le modèle. Les prédictions s'améliorent avec le temps." },
            { icon: <BarChart3 size={20} />, title: "Données transparentes",    desc: "Consultez les probabilités brutes, l'edge calculé et l'historique de performance du modèle." },
            { icon: <Zap size={20} />,       title: "Mise à jour en temps réel",desc: "Programme mis à jour dès l'ouverture des paris. Alertes instantanées sur les value bets." },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-lo text-accent-text">
                {icon}
              </div>
              <h3 className="mt-4 font-semibold text-fg">{title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-muted">{desc}</p>
            </div>
          ))}
        </section>

        {/* Disclaimer jeu responsable */}
        <section className="rounded-2xl border border-warn/30 bg-warn-lo p-6">
          <div className="flex gap-4">
            <Shield size={24} className="mt-0.5 shrink-0 text-warn" />
            <div>
              <h2 className="font-semibold text-fg">Jeu responsable</h2>
              <p className="mt-2 text-sm leading-6 text-fg">
                Les jeux d'argent comportent des risques : endettement, isolement, dépendance.
                Aucun pronostic, aussi précis soit-il, ne garantit un gain. Kayzen Turf AI est un outil
                d'aide à la décision et non un système de gains assurés. Si le jeu devient un problème,
                contactez{" "}
                <a href="https://www.joueurs-info-service.fr" rel="noopener noreferrer" target="_blank" className="font-semibold text-warn underline underline-offset-4">
                  Joueurs Info Service au 09 74 75 13 13
                </a>.
              </p>
            </div>
          </div>
        </section>

        <div className="mt-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-accent-text hover:text-accent">
            ← Retour au programme du jour
          </Link>
        </div>
      </div>
    </main>
  );
}
