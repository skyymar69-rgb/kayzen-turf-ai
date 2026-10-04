"use client";

import { useSyncExternalStore } from "react";
import { ChevronDown, ChevronUp, FlaskConical } from "lucide-react";

/**
 * Signale que les courses affichées sont fictives.
 *
 * Sans base configurée, le site sert `raceCards` — des courses inventées, avec
 * chevaux, cotes et pronostics d'apparence réelle. Rien ne le disait à
 * l'écran. Sur un service d'aide à la décision de pari, laisser croire à des
 * données authentiques est une pratique commerciale trompeuse
 * (code de la consommation, art. L. 121-2) autant qu'un manquement à la
 * transparence exigée par le règlement européen sur l'IA (art. 50).
 *
 * Une fois lu, le bandeau peut se réduire à une ligne — jamais disparaître :
 * la mention « données fictives » reste visible sur toutes les pages.
 */

const STORAGE_KEY = "kayzen-demo-compact";
const CHANGE_EVENT = "kayzen-demo-compact-change";

function souscrire(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function lireCompact(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function ecrireCompact(compact: boolean) {
  try {
    if (compact) window.localStorage.setItem(STORAGE_KEY, "1");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Stockage indisponible : le bandeau reste déplié, ce qui est le choix sûr.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function DemoBanner() {
  // Rendu serveur : bandeau complet. Le repli n'intervient qu'après hydratation.
  const compact = useSyncExternalStore(souscrire, lireCompact, () => false);

  return (
    <div className="border-b border-amber-500/40 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100 print:hidden" role="status">
      <div className={`mx-auto flex max-w-[1480px] items-start gap-3 px-4 sm:px-6 lg:px-8 ${compact ? "py-1.5" : "py-3"}`}>
        <FlaskConical aria-hidden="true" className="mt-0.5 shrink-0" size={compact ? 14 : 18} />
        {compact ? (
          <p className="text-xs leading-5">
            <strong className="font-bold">Mode démonstration</strong> — données fictives, à ne pas utiliser pour jouer.
          </p>
        ) : (
          <p className="text-sm leading-6">
            <strong className="font-bold">Mode démonstration.</strong>{" "}
            Aucune source de données n&apos;est connectée : les courses, cotes et pronostics affichés
            sont fictifs et ne correspondent à aucune épreuve réelle. Ils ne doivent servir à aucune
            décision de jeu.
          </p>
        )}
        <button
          aria-expanded={!compact}
          aria-label={compact ? "Déplier l'avertissement de démonstration" : "Réduire l'avertissement de démonstration"}
          className="ml-auto inline-flex size-7 shrink-0 items-center justify-center rounded-md transition hover:bg-amber-500/20"
          onClick={() => ecrireCompact(!compact)}
          type="button"
        >
          {compact ? <ChevronDown aria-hidden="true" size={14} /> : <ChevronUp aria-hidden="true" size={14} />}
        </button>
      </div>
    </div>
  );
}
