import { z } from "zod";

/**
 * Schémas d'entrée des routes API.
 *
 * Aucun paramètre n'était validé : `?date=` partait directement dans un cast
 * `::date` PostgreSQL — la requête levait, le `catch` renvoyait le jeu de
 * démonstration, et l'API répondait 200 avec des données fictives. Le même
 * `date` était par ailleurs recopié dans l'en-tête `Content-Disposition` du
 * PDF, où un guillemet suffisait à sortir du `filename="…"`.
 */

/** Date calendaire ISO, réellement existante (rejette 2026-02-31). */
export const schemaDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format attendu : AAAA-MM-JJ")
  .refine((valeur) => {
    const [annee, mois, jour] = valeur.split("-").map(Number);
    const date = new Date(Date.UTC(annee, mois - 1, jour));
    return (
      date.getUTCFullYear() === annee &&
      date.getUTCMonth() === mois - 1 &&
      date.getUTCDate() === jour
    );
  }, "Date inexistante au calendrier");

/** Jour relatif accepté par le dépôt de courses. */
export const schemaJourRelatif = z.enum(["yesterday", "today", "tomorrow"]);

/**
 * Identifiant de course tel que produit par l'import PMU
 * (`pmu-2026-08-16-R1-C3`). Borné en longueur et restreint aux caractères
 * effectivement utilisés : pas de quoi construire un motif hostile.
 */
export const schemaIdCourse = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9_-]+$/, "Identifiant de course invalide");

/**
 * Lit un paramètre optionnel et renvoie `null` s'il est absent.
 * Une valeur présente mais invalide reste une erreur — la masquer en `null`
 * reviendrait à servir silencieusement autre chose que ce qui est demandé.
 */
export function lireParametreOptionnel<T>(
  schema: z.ZodType<T>,
  valeur: string | null,
): { ok: true; valeur: T | null } | { ok: false; message: string } {
  if (valeur === null) return { ok: true, valeur: null };

  const resultat = schema.safeParse(valeur);
  if (resultat.success) return { ok: true, valeur: resultat.data };

  return { ok: false, message: resultat.error.issues[0]?.message ?? "Paramètre invalide" };
}

/** Réponse 400 normalisée pour un paramètre refusé. */
export function reponseParametreInvalide(parametre: string, message: string): Response {
  return Response.json(
    { error: `Paramètre « ${parametre} » invalide : ${message}` },
    { status: 400, headers: { "Cache-Control": "no-store" } },
  );
}
