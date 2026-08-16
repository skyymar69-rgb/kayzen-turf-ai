"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * Frontière d'erreur des pages.
 *
 * Aucune n'existait : une exception de rendu — panne base, données malformées —
 * remplaçait la page entière par l'écran d'erreur brut de Next, sans en-tête,
 * sans pied de page et en anglais. Cette frontière garde la charte, propose une
 * reprise sans rechargement complet et journalise l'incident.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // `digest` est l'identifiant que Next inscrit aussi dans les journaux
    // serveur : c'est lui qui permet de relier le rapport d'un utilisateur à la
    // trace complète, jamais exposée au navigateur.
    console.error("Erreur de rendu", error.digest ?? "(sans digest)", error);
  }, [error]);

  return (
    <main className="grid min-h-[60vh] place-items-center px-4 py-16" id="contenu-principal">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl border border-warn/30 bg-warn-lo">
          <AlertTriangle aria-hidden="true" className="text-warn" size={26} />
        </div>
        <h1 className="font-display text-2xl font-bold text-fg">Cette page n&apos;a pas pu s&apos;afficher</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Un incident technique empêche le chargement des données. Le programme des courses est
          rafraîchi en continu : une nouvelle tentative aboutit le plus souvent.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-muted">
            Référence incident : {error.digest}
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cta px-5 text-sm font-bold text-cta-text transition hover:bg-cta-hi"
            onClick={reset}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={15} />
            Réessayer
          </button>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-5 text-sm font-bold text-fg transition hover:bg-surface-sub"
            href="/"
          >
            Retour au programme
          </Link>
        </div>
      </div>
    </main>
  );
}
