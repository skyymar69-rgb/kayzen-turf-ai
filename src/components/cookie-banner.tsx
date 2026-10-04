"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Cookie } from "lucide-react";

const STORAGE_KEY = "kayzen-cookie-choice";
/** Signale un changement de choix aux bannières montées, sans rechargement. */
const CHANGE_EVENT = "kayzen-cookie-change";

/** Efface le choix enregistré, pour permettre le retrait du consentement (RGPD art. 7.3). */
export function resetCookieChoice() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Stockage indisponible (navigation privée stricte, quota, politique
    // d'entreprise) : rien à effacer, mais la bannière doit rouvrir malgré tout.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function souscrire(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/* Côté serveur, on ne sait rien du choix : on ne rend rien plutôt que d'afficher
   une bannière à ceux qui ont déjà répondu. */
const choixInconnu = () => "inconnu";

/**
 * `localStorage.getItem` lève une exception quand le stockage est bloqué
 * (Safari en navigation privée selon les versions, politique de sécurité,
 * cookies tiers désactivés dans une iframe). Sans garde, `useSyncExternalStore`
 * remontait l'erreur jusqu'à la limite d'erreur du layout : toute la page
 * disparaissait derrière « Une erreur est survenue » à cause d'une bannière.
 * Sans stockage, aucun choix ne pourrait être mémorisé : on ne montre pas la
 * bannière plutôt que de la faire réapparaître à chaque page.
 */
function lireChoix(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return choixInconnu();
  }
}

/**
 * Le retrait du consentement doit être aussi simple que son octroi (RGPD art.
 * 7.3). Une fois le choix fait, la bannière ne revenait jamais et `resetCookieChoice`
 * n'était appelée nulle part : le seul recours était de vider le stockage du
 * navigateur. Ce bouton, présent en pied de page sur toutes les pages, rouvre la
 * bannière et remet le choix à zéro.
 */
export function CookiePreferencesButton({ className }: { className?: string }) {
  return (
    <button
      className={className}
      onClick={resetCookieChoice}
      type="button"
    >
      Gérer les cookies
    </button>
  );
}

export function CookieBanner() {
  // Lire localStorage dans l'initialiseur de useState divergeait entre le rendu
  // serveur (toujours `false`, donc rien) et le rendu client (`true` à la
  // première visite, donc une section entière) — mismatch d'hydratation sur
  // 100 % des nouveaux visiteurs, et sur toutes les pages. `useSyncExternalStore`
  // gère ce décalage : rendu serveur neutre, puis lecture réelle après hydratation.
  const choix = useSyncExternalStore(souscrire, lireChoix, choixInconnu);

  function saveChoice(choice: "accepted" | "refused") {
    try {
      window.localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // Stockage indisponible : le choix ne sera pas mémorisé, mais rien ne
      // doit casser pour autant.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  if (choix) return null;

  return (
    <section
      aria-label="Gestion des cookies"
      className="fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-[90] rounded-xl border border-border bg-surface p-3 text-fg shadow-2xl sm:p-4 lg:inset-x-auto lg:bottom-3 lg:right-4 lg:max-w-xl"
    >
      <h2 className="flex items-center gap-2 text-sm font-bold sm:text-base">
        <Cookie aria-hidden="true" size={17} className="text-accent-text" />
        Confidentialité et cookies
      </h2>
      {/* Sur mobile, la bannière couvrait la moitié de l'écran : le texte
          essentiel reste, le détail n'apparaît qu'à partir de sm. */}
      <p className="mt-1.5 text-xs leading-5 text-muted sm:mt-2 sm:text-sm sm:leading-6">
        Seuls les cookies strictement nécessaires sont utilisés par défaut.
        <span className="hidden sm:inline">
          {" "}Les mesures d’audience ou services tiers ne sont activés qu’après consentement. Vous pouvez revenir
          sur ce choix à tout moment via « Gérer les cookies » en pied de page.
        </span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2 sm:mt-4">
        <button
          className="min-h-11 flex-1 rounded-lg bg-cta px-4 font-bold text-cta-text transition hover:bg-cta-hi sm:flex-none"
          onClick={() => saveChoice("accepted")}
          type="button"
        >
          Accepter
        </button>
        <button
          className="min-h-11 flex-1 rounded-lg border border-border bg-surface px-4 font-bold text-fg transition hover:bg-surface-sub sm:flex-none"
          onClick={() => saveChoice("refused")}
          type="button"
        >
          Refuser
        </button>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-lg px-4 font-bold text-accent-text underline-offset-4 hover:underline"
          href="/cookies"
        >
          En savoir plus
        </Link>
      </div>
    </section>
  );
}
