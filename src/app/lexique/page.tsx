import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import type { Metadata } from "next";
import { GLOSSARY } from "@/lib/lexique";

export const metadata: Metadata = {
  title: "Lexique turf",
  description: "Tous les termes du turf expliqués : avis de l'IA, value bet, Kelly criterion, Quinté+, PMU, arrivée, cote, mise…",
  alternates: { canonical: "/lexique" },
};

const categories = Array.from(new Set(GLOSSARY.map((g) => g.category)));

/** Identifiant DOM d'une catégorie : « Paris PMU » → `cat-paris-pmu` (un id ne peut contenir d'espace). */
const categorieId = (cat: string) => `cat-${cat.toLowerCase().replace(/\s+/g, "-")}`;

export default function LexiquePage() {
  return (
    <main className="min-h-screen bg-bg pb-20" id="contenu-principal">
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
            <p className="text-xs font-bold uppercase tracking-widest text-muted">Kayzen Turf</p>
            <h1 className="font-display text-3xl font-bold text-fg">Lexique turf</h1>
            <p className="mt-1 text-sm text-muted">Tous les termes indispensables pour comprendre nos analyses et pronostics.</p>
          </div>
        </div>

        <div className="grid gap-8">
          {categories.map((cat) => (
            <section key={cat} aria-labelledby={categorieId(cat)}>
              <h2 id={categorieId(cat)} className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted">
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
            <Link href="/mentions-legales" className="font-semibold text-accent-text underline underline-offset-2 hover:text-accent">
              Contactez-nous
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
