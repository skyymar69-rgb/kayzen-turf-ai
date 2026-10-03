import Link from "next/link";
import { ArrowRight, BarChart3, Brain, Check, Shield, Sparkles, Zap } from "lucide-react";

export const metadata = {
  title: "Tarifs : 100 % gratuit",
  description: "Kayzen Turf est gratuit : toutes les courses analysées, profils des chevaux, IA comparée au marché, suivi de performance public et alertes, sans abonnement ni publicité.",
  alternates: { canonical: "/tarifs" },
};

/**
 * Octobre 2026 : le site reste gratuit. Les grilles Starter / Premium / Pro
 * annonçaient des offres qui n'existaient pas, et aucun signal n'a montré de
 * rendement positif mesuré (voir /track-record) : rien ne justifiait de les
 * faire payer. La page garde son adresse, déjà indexée et liée depuis le menu.
 */
const INCLUDED = [
  "Toutes les courses du programme PMU analysées, hier, aujourd'hui et demain",
  "Classement IA, probabilités de victoire et de podium",
  "Profils des chevaux : base, caché, value, outsider, à éviter",
  "IA sans cote comparée au marché, mouvements de cotes et parts des enjeux",
  "Verdict de course en une ligne et fiche détaillée de chaque cheval",
  "Cotes relues en continu avant le départ, avec leur âge affiché",
  "Chevaux suivis et alertes avant le départ ou en cas de non-partant",
  "Suivi de performance public, rendement mesuré sur les rapports officiels",
] as const;

export default function TarifsPage() {
  return (
    <main className="min-h-screen bg-bg pb-20" id="contenu-principal">
      <div className="mx-auto max-w-[1480px] px-4 pt-8 sm:px-6 lg:px-8">

        {/* Header */}
        <section className="mb-10 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-lo px-3 py-1 text-xs font-bold uppercase tracking-widest text-accent-text">
            <Sparkles size={11} />
            Tarifs
          </span>
          <h1 className="mt-4 font-display text-4xl font-bold text-fg sm:text-5xl">
            Kayzen Turf est gratuit
          </h1>
          <p className="mt-4 mx-auto max-w-2xl text-base leading-7 text-muted">
            Pas d’abonnement, pas de publicité, pas de compte à créer. Kayzen Turf est un outil d’aide à la
            décision : nous publions de l’analyse et ses résultats mesurés, pas des certitudes.
          </p>
        </section>

        <section className="mx-auto mb-12 max-w-3xl rounded-2xl border-2 border-accent bg-surface p-6 shadow-sm sm:p-8" aria-labelledby="inclus-titre">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="inclus-titre" className="font-display text-2xl font-bold text-fg">Tout est inclus</h2>
            <p className="font-display text-3xl font-bold text-fg">0 €</p>
          </div>
          <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
            {INCLUDED.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-fg">
                <Check size={15} className="mt-0.5 shrink-0 text-accent" />
                {f}
              </li>
            ))}
          </ul>
          <Link
            href="/"
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-accent-fg transition hover:bg-accent-hi"
          >
            Voir le programme du jour <ArrowRight size={14} />
          </Link>
        </section>

        {/* Garanties */}
        <section className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Garanties">
          {[
            { icon: <Shield size={20} />,    title: "Pas de promesse de gain",  desc: "Nous vendons de l'analyse, pas des certitudes. La transparence est notre valeur principale." },
            { icon: <Brain size={20} />,     title: "Rendement publié",         desc: "Chaque pronostic est gelé avant le départ puis confronté aux rapports officiels du PMU. Le rendement de chaque signal est public, même négatif." },
            { icon: <BarChart3 size={20} />, title: "Données transparentes",    desc: "Consultez les probabilités brutes, l'edge calculé et l'historique de performance du modèle." },
            { icon: <Zap size={20} />,       title: "Cotes fraîches",           desc: "Cotes relues chaque minute dans le dernier quart d'heure avant le départ, et âge de la cote affiché sur chaque course." },
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
                Les jeux d’argent comportent des risques : endettement, isolement, dépendance.
                Aucun pronostic, aussi précis soit-il, ne garantit un gain. Kayzen Turf est un outil
                d’aide à la décision et non un système de gains assurés. Si le jeu devient un problème,
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
