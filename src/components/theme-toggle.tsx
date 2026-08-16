"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "kayzen-theme";
/** Propage le changement aux autres bascules montées, dans le même onglet. */
const CHANGE_EVENT = "kayzen-theme-change";

/**
 * Le thème vit déjà sur `document.documentElement.dataset.theme`, écrit par le
 * script anti-FOUC du layout avant le premier rendu. C'est donc lui la source
 * de vérité, et non un état React.
 *
 * L'ancienne version relisait localStorage dans un `useEffect` puis appelait
 * `setTheme` et `setMounted` : deux rendus en cascade après chaque hydratation,
 * sur toutes les pages, pour une information déjà connue du DOM. Le linter React
 * le signalait (`react-hooks/set-state-in-effect`).
 *
 * `useSyncExternalStore` lit la valeur directement, avec un instantané serveur
 * distinct — l'hydratation est donc garantie identique au HTML rendu.
 */
function souscrire(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  // Synchronise les onglets ouverts sur le même site.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function lireTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/** Le serveur ne connaît pas la préférence : il rend le thème clair. */
function themeServeur(): Theme {
  return "light";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(souscrire, lireTheme, themeServeur);
  const sombre = theme === "dark";

  function basculer() {
    const suivant: Theme = sombre ? "light" : "dark";
    document.documentElement.dataset.theme = suivant;
    try {
      window.localStorage.setItem(STORAGE_KEY, suivant);
    } catch {
      // Stockage indisponible (navigation privée stricte) : le thème reste
      // appliqué pour la session, il ne sera simplement pas mémorisé.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <button
      aria-label={sombre ? "Activer le mode clair" : "Activer le mode sombre"}
      aria-pressed={sombre}
      className="inline-flex size-9 items-center justify-center rounded-lg border border-white/30 bg-white/12 text-slate-100 transition hover:bg-white/20 hover:text-white"
      onClick={basculer}
      title={sombre ? "Mode clair" : "Mode sombre"}
      type="button"
    >
      <span className="inline-flex transition-transform duration-300">
        {sombre ? <Sun aria-hidden="true" size={16} /> : <Moon aria-hidden="true" size={16} />}
      </span>
    </button>
  );
}
