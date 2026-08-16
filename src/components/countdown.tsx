"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { formaterCompteARebours, secondesAvantDepart } from "@/lib/paris-time";

/**
 * Compte à rebours avant le départ.
 *
 * Il vivait dans `CourseDetail`, un composant de 1 600 lignes : son
 * `setInterval` d'une seconde déclenchait donc un rendu complet de la page
 * course — tableaux de partants, panneaux de tickets, graphes de probabilités —
 * soixante fois par minute. Les `useMemo` évitaient de recalculer les données,
 * mais React parcourait tout de même l'arbre entier à chaque tic, ce qui pesait
 * sur l'INP pendant que l'utilisateur faisait défiler ou triait.
 *
 * Isolé ici, le tic ne re-rend plus qu'un `<span>`.
 *
 * Le calcul passe par `secondesAvantDepart`, qui raisonne à l'heure de Paris.
 * L'ancienne version faisait `race_t.setHours(h, m)` sur une date locale : un
 * visiteur hors du fuseau français voyait un décompte faux de plusieurs heures.
 */
export function Countdown({
  relativeDay,
  startTime,
}: {
  relativeDay: string;
  startTime: string;
}) {
  const [restant, setRestant] = useState<string | null>(null);

  useEffect(() => {
    if (relativeDay !== "today") return;

    // Un `setTimeout` qui se replanifie, plutôt qu'un `setInterval` : une fois
    // le départ passé, il cesse de lui-même au lieu de tourner jusqu'à la
    // navigation suivante.
    let minuteur: ReturnType<typeof setTimeout> | undefined;

    function programmer() {
      const secondes = secondesAvantDepart(startTime);
      setRestant(secondes === null ? null : formaterCompteARebours(secondes));
      if (secondes === null) return;
      minuteur = setTimeout(programmer, 1_000);
    }

    programmer();
    return () => clearTimeout(minuteur);
  }, [relativeDay, startTime]);

  if (relativeDay !== "today" || !restant) return null;

  return (
    // `text-cta` donnait #1eb854 sur un fond quasi blanc, soit 2,4:1 — sous le
    // minimum WCAG de 4,5:1. `--accent-text` est le jeton prévu pour du texte.
    // Pas de région live : à raison d'un changement par seconde, elle noierait
    // le lecteur d'écran. L'horaire reste lisible dans « Départ HH:MM ».
    <span className="flex items-center gap-1 rounded-lg bg-cta/10 px-2 py-0.5 text-sm font-bold text-accent-text">
      <Timer aria-hidden="true" size={12} />
      Départ dans {restant}
    </span>
  );
}
