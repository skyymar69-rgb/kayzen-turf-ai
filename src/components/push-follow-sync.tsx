"use client";

import { useMemo } from "react";
import { useFollowedHorses } from "@/hooks/use-followed-horses";
import { usePushAlerts } from "@/hooks/use-push-alerts";

/**
 * Tient la liste des chevaux suivis à jour côté serveur, quelle que soit la
 * page où le visiteur suit ou retire un cheval. N'affiche rien et ne fait rien
 * tant que les alertes ne sont pas activées sur ce navigateur.
 */
export function PushFollowSync() {
  const { followed } = useFollowedHorses();
  const horseIds = useMemo(() => [...followed.keys()], [followed]);
  usePushAlerts(horseIds);
  return null;
}
