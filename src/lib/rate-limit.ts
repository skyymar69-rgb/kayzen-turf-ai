/**
 * Limitation de débit par adresse IP, en mémoire de l'instance.
 *
 * Aucune route API n'était protégée. `/api/pdf/pronostics` rend un PDF complet
 * — plusieurs centaines de millisecondes de CPU et de mémoire par appel, sans
 * cache puisque `no-store` — et suffisait donc à saturer une instance depuis un
 * seul poste. `/api/simulate-bet` accepte en plus des POST anonymes.
 *
 * Le compteur vit dans le processus : sur une plateforme sans état (Vercel), il
 * est propre à chaque instance et ne survit pas à un redémarrage. C'est un
 * garde-fou contre l'abus opportuniste, pas une protection anti-DDoS — celle-ci
 * relève de la couche edge (Vercel WAF, Cloudflare). Voir la checklist de
 * livraison pour l'activation côté plateforme.
 */

type Fenetre = { compte: number; expireA: number };

const compteurs = new Map<string, Fenetre>();

/**
 * Purge les fenêtres échues. Sans elle, la Map croît indéfiniment avec le
 * nombre d'IP distinctes — une fuite mémoire lente sur une instance longue.
 */
function purger(maintenant: number) {
  for (const [cle, fenetre] of compteurs) {
    if (fenetre.expireA <= maintenant) compteurs.delete(cle);
  }
}

export type ResultatLimite = {
  autorise: boolean;
  /** Appels restants dans la fenêtre courante. */
  restant: number;
  /** Secondes avant réouverture, pour l'en-tête `Retry-After`. */
  reessayerDans: number;
};

/**
 * @param identifiant clé de comptage (typiquement `route:ip`)
 * @param limite      nombre d'appels autorisés par fenêtre
 * @param fenetreMs   durée de la fenêtre glissante, en millisecondes
 */
export function limiterDebit(
  identifiant: string,
  limite: number,
  fenetreMs: number,
): ResultatLimite {
  const maintenant = Date.now();

  // Purge amortie : une fois sur cinquante environ, pour ne pas parcourir
  // toute la Map à chaque requête.
  if (compteurs.size > 500) purger(maintenant);

  const fenetre = compteurs.get(identifiant);

  if (!fenetre || fenetre.expireA <= maintenant) {
    compteurs.set(identifiant, { compte: 1, expireA: maintenant + fenetreMs });
    return { autorise: true, restant: limite - 1, reessayerDans: 0 };
  }

  fenetre.compte += 1;

  if (fenetre.compte > limite) {
    return {
      autorise: false,
      restant: 0,
      reessayerDans: Math.ceil((fenetre.expireA - maintenant) / 1000),
    };
  }

  return { autorise: true, restant: limite - fenetre.compte, reessayerDans: 0 };
}

/**
 * Adresse de l'appelant.
 *
 * `x-forwarded-for` est une liste `client, proxy1, proxy2` : seule la première
 * entrée intéresse, et uniquement parce que la plateforme la réécrit. En
 * l'absence d'en-tête — appel direct, tests — on regroupe sous une clé unique
 * plutôt que de laisser passer sans compter.
 */
export function adresseAppelant(requete: Request): string {
  const transmis = requete.headers.get("x-forwarded-for");
  if (transmis) return transmis.split(",")[0]!.trim();
  return requete.headers.get("x-real-ip") ?? "inconnu";
}

/** Réponse 429 normalisée, avec les en-têtes attendus par les clients. */
export function reponseTropDeRequetes(resultat: ResultatLimite): Response {
  return Response.json(
    { error: "Trop de requêtes. Réessayez dans un instant." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, resultat.reessayerDans)),
        "Cache-Control": "no-store",
      },
    },
  );
}
