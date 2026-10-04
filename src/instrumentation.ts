import type { Instrumentation } from "next";

/**
 * Remontée des erreurs serveur, sans service tiers ni compte.
 *
 * Next appelle `onRequestError` pour chaque erreur capturée côté serveur
 * (rendu des composants serveur, route API, action, proxy). On écrit une ligne
 * JSON unique sur la sortie d'erreur : les journaux d'exécution Vercel la
 * conservent, et une ligne structurée se filtre (`"kind":"request-error"`)
 * là où une pile brute se lit mal.
 *
 * `console.error` est ici voulu : c'est le canal de sortie lui-même, pas un
 * reste de débogage.
 *
 * Ce qui part dans la ligne, et ce qui n'y part pas :
 *  - le chemin SANS chaîne de requête : `?endpoint=…` ou un identifiant passé
 *    en paramètre n'ont rien à faire dans un journal ;
 *  - ni en-têtes, ni cookies, ni adresse IP ;
 *  - le message, tronqué : il vient de notre code ou d'une bibliothèque, pas
 *    d'une saisie de visiteur, mais une borne évite qu'une erreur verbeuse
 *    (requête SQL complète, réponse distante) n'inonde le journal ;
 *  - le `digest`, qui relie la ligne à l'erreur affichée côté navigateur.
 */

/** Longueur maximale du message conservé dans la ligne de journal. */
const LONGUEUR_MESSAGE_MAX = 300;

type ContexteErreur = Parameters<Instrumentation.onRequestError>[2];

/** Chemin sans chaîne de requête ni fragment. */
function cheminSansRequete(chemin: string): string {
  return chemin.split(/[?#]/, 1)[0] || "/";
}

function lireDigest(erreur: unknown): string | undefined {
  if (typeof erreur === "object" && erreur !== null && "digest" in erreur) {
    return String((erreur as { digest: unknown }).digest);
  }
  return undefined;
}

function lireMessage(erreur: unknown): string {
  const brut = erreur instanceof Error ? erreur.message : String(erreur);
  return brut.length > LONGUEUR_MESSAGE_MAX ? `${brut.slice(0, LONGUEUR_MESSAGE_MAX)}…` : brut;
}

export const onRequestError: Instrumentation.onRequestError = (erreur, requete, contexte: ContexteErreur) => {
  const ligne = {
    kind: "request-error",
    at: new Date().toISOString(),
    method: requete.method,
    path: cheminSansRequete(requete.path),
    route: contexte.routePath,
    routeType: contexte.routeType,
    digest: lireDigest(erreur),
    name: erreur instanceof Error ? erreur.name : typeof erreur,
    message: lireMessage(erreur),
  };
  console.error(JSON.stringify(ligne));
};
