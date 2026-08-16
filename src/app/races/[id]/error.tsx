"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";

/**
 * Frontière d'erreur propre à une course.
 *
 * Elle est granulaire à dessein : une course dont les données sont
 * inexploitables ne doit pas emporter tout le site. En-tête et pied de page
 * restent en place, et le visiteur repart vers le programme du jour plutôt que
 * vers une impasse.
 */
export default function CourseError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Erreur sur la page course", error.digest ?? "(sans digest)", error);
  }, [error]);

  return (
    <main className="mx-auto min-h-[60vh] max-w-[900px] px-4 py-16 sm:px-6 lg:px-8" id="contenu-principal">
      <div className="rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <div className="mb-5 grid size-14 place-items-center rounded-2xl border border-warn/30 bg-warn-lo">
          <AlertTriangle aria-hidden="true" className="text-warn" size={26} />
        </div>
        <h1 className="font-display text-2xl font-bold text-fg">
          L&apos;analyse de cette course est indisponible
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          Les données de cette épreuve n&apos;ont pas pu être chargées. Les autres courses du
          programme restent consultables.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-muted">Référence incident : {error.digest}</p>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cta px-5 text-sm font-bold text-cta-text transition hover:bg-cta-hi"
            onClick={reset}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={15} />
            Réessayer
          </button>
          <Link
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-5 text-sm font-bold text-fg transition hover:bg-surface-sub"
            href="/"
          >
            <ArrowLeft aria-hidden="true" size={15} />
            Programme du jour
          </Link>
        </div>
      </div>
    </main>
  );
}
