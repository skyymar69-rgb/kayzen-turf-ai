"use client";

import { useCallback, useState } from "react";
import { jourParis } from "@/lib/paris-time";

export type EtatPdf = "repos" | "chargement" | "echec";

/**
 * Téléchargement du PDF des pronostics d'une journée.
 *
 * Le comportement vivait en deux copies : une dans l'en-tête (corrigée), une
 * dans le tableau de bord qui gardait les trois défauts d'origine — ancre jamais
 * insérée dans le document (Firefox ignore alors le clic), `revokeObjectURL`
 * appelé avant que le navigateur n'ait lu le blob (téléchargement coupé), et
 * `alert()` bloquant en cas d'échec. Un seul hook, deux boutons.
 *
 * La date est calculée au moment du clic, jamais au rendu : évaluer « le jour à
 * Paris » pendant le rendu divergeait entre le HTML statique (généré à une
 * date) et l'hydratation (à une autre) — décalage d'hydratation à chaque
 * changement de jour.
 */
export function usePdfJour() {
  const [etat, setEtat] = useState<EtatPdf>("repos");

  const telecharger = useCallback(async (dateDemandee?: string) => {
    setEtat((precedent) => (precedent === "chargement" ? precedent : "chargement"));

    const date = dateDemandee || jourParis();
    let url: string | null = null;

    try {
      const reponse = await fetch(`/api/pdf/pronostics?date=${encodeURIComponent(date)}`);
      if (!reponse.ok) throw new Error(`Réponse ${reponse.status}`);

      const blob = await reponse.blob();
      url = URL.createObjectURL(blob);

      const lien = document.createElement("a");
      lien.href = url;
      lien.download = `pronoturf-pronostics-${date}.pdf`;
      // Firefox exige que l'ancre soit dans le document pour honorer le clic.
      document.body.appendChild(lien);
      lien.click();
      lien.remove();

      setEtat("repos");
    } catch (cause) {
      console.error("Téléchargement du PDF impossible", cause);
      // `alert()` bloquait le fil principal et sortait de la charte : l'échec
      // est rendu par le bouton lui-même, et annoncé aux lecteurs d'écran.
      setEtat("echec");
    } finally {
      // Révoquer immédiatement après `click()` pouvait couper le téléchargement
      // avant que le navigateur n'ait lu le blob. Une seconde suffit.
      // La copie locale fige la valeur : `url` est réassignable, et le
      // rétrécissement de type ne franchit pas la frontière de la fermeture.
      const aRevoquer = url;
      if (aRevoquer) setTimeout(() => URL.revokeObjectURL(aRevoquer), 1_000);
    }
  }, []);

  return { etat, telecharger };
}
