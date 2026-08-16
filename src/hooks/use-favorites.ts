"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "kz-favorites";
/** Notifie les composants montés d'un changement, sans rechargement. */
const CHANGE_EVENT = "kz-favorites-change";

/**
 * Favoris persistés dans le stockage local.
 *
 * `useState(loadFavorites)` lisait localStorage dans l'initialiseur : le rendu
 * serveur produisait un ensemble vide, le rendu client l'ensemble réel. Tout
 * visiteur ayant des favoris obtenait donc un décalage d'hydratation — le
 * compteur « ★ 3 » du bandeau et les étoiles des lignes différaient entre le
 * HTML servi et le premier rendu React. C'est le même défaut que celui déjà
 * corrigé sur la bannière cookies, et la même réponse : `useSyncExternalStore`,
 * qui distingue explicitement l'instantané serveur du client.
 *
 * L'instantané est mémorisé : `getSnapshot` doit retourner une valeur stable
 * par référence tant que la source n'a pas changé, sinon React boucle en
 * « The result of getSnapshot should be cached ».
 */
let cacheBrut: string | null = null;
let cacheEnsemble: ReadonlySet<string> = new Set();

const ENSEMBLE_VIDE: ReadonlySet<string> = new Set();

function lireFavoris(): ReadonlySet<string> {
  let brut: string | null;
  try {
    brut = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return ENSEMBLE_VIDE;
  }

  if (brut === cacheBrut) return cacheEnsemble;

  cacheBrut = brut;
  try {
    const analyse: unknown = brut ? JSON.parse(brut) : [];
    cacheEnsemble = new Set(Array.isArray(analyse) ? analyse.filter((v): v is string => typeof v === "string") : []);
  } catch {
    cacheEnsemble = new Set();
  }

  return cacheEnsemble;
}

/** Le serveur ne connaît pas les favoris du visiteur. */
function favorisServeur(): ReadonlySet<string> {
  return ENSEMBLE_VIDE;
}

function souscrire(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useFavorites() {
  const favs = useSyncExternalStore(souscrire, lireFavoris, favorisServeur);

  const toggle = useCallback((id: string) => {
    const suivant = new Set(lireFavoris());
    if (suivant.has(id)) suivant.delete(id);
    else suivant.add(id);

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...suivant]));
    } catch {
      // Stockage indisponible : le favori ne sera pas mémorisé, mais rien ne
      // doit casser pour autant.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { favs, toggle };
}
