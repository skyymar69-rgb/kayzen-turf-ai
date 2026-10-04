import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Sparkles } from "lucide-react";
import { CHANGELOG, type CategorieChangement } from "@/lib/changelog";

export const metadata: Metadata = {
  title: "Nouveautés — ce qui a changé sur Kayzen Turf",
  description:
    "Le journal des évolutions de Kayzen Turf : nouvelles fonctions, changements et corrections, datés, du plus récent au plus ancien.",
  alternates: { canonical: "/nouveautes" },
};

const dateFr = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });

/** Teinte du libellé de catégorie, sur les jetons du thème. */
const TEINTE: Record<CategorieChangement, string> = {
  Ajouté: "bg-accent-lo text-accent-text",
  Modifié: "bg-surface-sub text-fg",
  Corrigé: "bg-warn-lo text-fg",
  Sécurité: "bg-surface-sub text-fg",
};

export default function NouveautesPage() {
  return (
    <main className="min-h-screen bg-bg pb-20" id="contenu-principal">
      <div className="mx-auto max-w-3xl px-4 pt-6 sm:px-6 lg:px-8">
        <Link
          className="mb-6 inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm font-medium text-muted shadow-sm transition hover:border-accent hover:text-accent-text"
          href="/"
        >
          <ArrowLeft aria-hidden="true" size={14} /> Accueil
        </Link>

        <header>
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-accent-text">
            <Sparkles aria-hidden="true" size={16} /> Journal
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-fg sm:text-4xl">Nouveautés</h1>
          <p className="mt-3 text-base leading-7 text-muted">
            Ce qui a changé sur le site, daté, du plus récent au plus ancien. Les corrections y figurent au même titre
            que les nouveautés : quand quelque chose était faux, nous le disons.
          </p>
        </header>

        <ol className="mt-10 space-y-6">
          {CHANGELOG.map((entree) => (
            <li key={entree.date}>
              <article className="rounded-2xl border border-border bg-surface p-5 shadow-sm" aria-labelledby={`maj-${entree.date}`}>
                <p className="font-mono text-xs text-muted">
                  <time dateTime={entree.date}>{dateFr(entree.date)}</time>
                </p>
                <h2 id={`maj-${entree.date}`} className="mt-1 text-xl font-bold text-fg">
                  {entree.titre}
                </h2>
                <div className="mt-4 space-y-4">
                  {entree.changements.map((groupe) => (
                    <section key={groupe.categorie}>
                      <h3 className="text-sm">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${TEINTE[groupe.categorie]}`}>
                          {groupe.categorie}
                        </span>
                      </h3>
                      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-muted">
                        {groupe.elements.map((element) => (
                          <li key={element}>{element}</li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
