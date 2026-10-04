"use client";

import { Download, Loader2 } from "lucide-react";
import { usePdfJour } from "@/hooks/use-pdf-jour";

/**
 * Même hook que le bouton de l'en-tête : cette copie gardait l'ancre hors du
 * document, la révocation immédiate du blob et un `alert()` bloquant.
 */
export function PdfDownloadButton({ date }: { date: string }) {
  const { etat, telecharger } = usePdfJour();
  const chargement = etat === "chargement";

  return (
    <button
      disabled={chargement}
      onClick={() => telecharger(date)}
      type="button"
      className="inline-flex items-center gap-2 rounded-xl border border-accent/40 bg-accent-lo px-4 py-2.5 text-sm font-semibold text-accent-text transition hover:bg-accent hover:text-accent-fg disabled:opacity-60"
    >
      {chargement
        ? <><Loader2 aria-hidden="true" size={15} className="animate-spin" /> Génération…</>
        : etat === "echec"
          ? <><Download aria-hidden="true" size={15} /> Échec — réessayer</>
          : <><Download aria-hidden="true" size={15} /> PDF pronostics</>
      }
      {etat === "echec" && <span className="sr-only" role="alert">Le PDF n&apos;a pas pu être généré.</span>}
    </button>
  );
}
