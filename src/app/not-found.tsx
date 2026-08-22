import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Compass, Flag, Home } from "lucide-react";

/**
 * Sans ce fichier, Next servait sa 404 par défaut : fond blanc, texte anglais,
 * ni en-tête ni pied de page. Une course retirée du programme — cas courant —
 * envoyait donc le visiteur sur une impasse hors charte.
 */
export const metadata: Metadata = {
  title: "Page introuvable",
  description: "Cette page n'existe pas ou la course n'est plus au programme.",
  robots: { index: false, follow: true },
};

const PISTES = [
  {
    href: "/",
    icon: Home,
    title: "Programme du jour",
    body: "Toutes les réunions d'hier, d'aujourd'hui et de demain.",
  },
  {
    href: "/pronostics",
    icon: Flag,
    title: "Pronostics PMU",
    body: "Ordre probable, base IA et value bets, course par course.",
  },
  {
    href: "/prono-score",
    icon: Compass,
    title: "Le PronoScore",
    body: "Comment le score est calculé, et ce qu'il ne dit pas.",
  },
  {
    href: "/lexique",
    icon: BookOpen,
    title: "Lexique turf",
    body: "Value bet, Kelly, musique, réduction kilométrique…",
  },
];

export default function NotFound() {
  return (
    <main className="min-h-screen bg-bg pb-20" id="contenu-principal">
      <div className="mx-auto max-w-[900px] px-4 pt-16 sm:px-6 lg:px-8">
        <p className="font-mono text-sm font-bold uppercase tracking-widest text-muted">Erreur 404</p>
        <h1 className="mt-3 font-display text-4xl font-bold text-fg sm:text-5xl">
          Cette page n&apos;est pas au programme
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
          L&apos;adresse demandée n&apos;existe pas, ou la course que vous cherchiez a quitté le
          programme — les réunions ne restent en ligne que sur trois jours glissants.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-cta px-5 font-bold text-cta-text transition hover:bg-cta-hi"
            href="/"
          >
            Retour au programme
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface px-5 font-bold text-fg transition hover:bg-surface-sub"
            href="/pronostics"
          >
            Voir les pronostics du jour
          </Link>
        </div>

        <nav aria-label="Pages principales" className="mt-12 grid gap-3 sm:grid-cols-2">
          {PISTES.map(({ body, href, icon: Icon, title }) => (
            <Link
              className="kz-card-lift flex items-start gap-3 rounded-xl border border-border bg-surface p-4"
              href={href}
              key={href}
            >
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-lo text-accent-text">
                <Icon size={17} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block font-bold text-fg">{title}</span>
                <span className="mt-1 block text-sm leading-6 text-muted">{body}</span>
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
