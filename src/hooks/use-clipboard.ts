"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Durée d'affichage du retour « copié » / « échec ». */
const DUREE_RETOUR_MS = 2_000;

export type EtatCopie = "repos" | "copie" | "echec";

/**
 * Copie dans le presse-papiers, avec retour visuel.
 *
 * Quatre composants dupliquaient le même bloc, avec trois défauts partagés :
 *
 * 1. `navigator.clipboard.writeText(…)` était appelé sans vérifier que l'API
 *    existe. Hors contexte sécurisé — HTTP simple, certains WebView — `clipboard`
 *    vaut `undefined` : l'accès à `.writeText` lève une `TypeError` **synchrone**,
 *    que le `.catch()` accroché à la promesse ne rattrape pas. Le clic cassait
 *    le gestionnaire d'événement sans que rien ne s'affiche.
 * 2. L'échec était avalé par un `.catch(() => {})` : refus de permission,
 *    document non focalisé — l'utilisateur cliquait dans le vide.
 * 3. `setTimeout` n'était jamais annulé : un démontage pendant les deux secondes
 *    de retour laissait un minuteur programmer un `setState` sur un composant
 *    disparu.
 *
 * Le repli `execCommand('copy')` couvre les contextes non sécurisés, où l'API
 * moderne est indisponible par conception.
 */
export function useClipboard() {
  const [etat, setEtat] = useState<EtatCopie>("repos");
  const minuteurRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(minuteurRef.current), []);

  const copier = useCallback(async (texte: string) => {
    clearTimeout(minuteurRef.current);

    let reussi = false;

    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(texte);
        reussi = true;
      } catch {
        reussi = false;
      }
    }

    if (!reussi) reussi = copierParRepli(texte);

    setEtat(reussi ? "copie" : "echec");
    minuteurRef.current = setTimeout(() => setEtat("repos"), DUREE_RETOUR_MS);

    return reussi;
  }, []);

  return { etat, copier };
}

/**
 * Repli hors contexte sécurisé. `document.execCommand` est déprécié mais reste
 * le seul mécanisme disponible en HTTP simple, et sa dépréciation n'entraîne
 * aucun retrait annoncé.
 */
function copierParRepli(texte: string): boolean {
  try {
    const zone = document.createElement("textarea");
    zone.value = texte;
    // Hors écran plutôt que `display: none` : un élément non rendu ne peut pas
    // recevoir la sélection.
    zone.setAttribute("readonly", "");
    zone.style.position = "fixed";
    zone.style.top = "-9999px";
    zone.setAttribute("aria-hidden", "true");
    document.body.appendChild(zone);
    zone.select();
    const reussi = document.execCommand("copy");
    zone.remove();
    return reussi;
  } catch {
    return false;
  }
}
