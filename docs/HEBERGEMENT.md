# Hébergement et localisation des traitements

## Constat de l'audit

Le projet n'avait pas de `vercel.json`. Les fonctions serveur étaient donc
déployées dans la région Vercel par défaut, **`iad1` (Washington, États-Unis)**,
alors que la base Neon vit à **`eu-central-1` (Francfort)**.

Deux conséquences, l'une technique et l'autre juridique.

### Latence

Chaque rendu de page fait deux requêtes en base (les courses, puis les
partants). Avec un aller-retour transatlantique à environ 90 ms, cela ajoutait
près de 360 ms au TTFB, avant même le moindre calcul. C'est le plancher que le
rendu incrémental (`revalidate = 60`) masquait sur cache chaud, mais que payait
chaque revalidation et chaque page rendue à la demande.

`regions: ["fra1"]` place le calcul dans la même région AWS que la base : le
temps d'aller-retour tombe sous la milliseconde.

### Conformité

La politique de confidentialité doit décrire les traitements tels qu'ils sont,
pas tels qu'on les souhaite (RGPD art. 13). Tant que les fonctions tournaient
aux États-Unis, écrire « déploiement configuré sur une région européenne »
aurait été inexact — et une information inexacte sur un transfert hors UE est
précisément ce que l'article 13.1.f cherche à éviter.

Avec `fra1`, le calcul et le stockage restent dans l'Union. Vercel Inc. et Neon
Inc. demeurent des sociétés américaines : les clauses contractuelles types et,
pour Vercel, la certification EU-US Data Privacy Framework encadrent les accès
distants (support, exploitation). C'est ce que dit désormais la page
`/confidentialite`.

## Vérification après déploiement

    curl -sI https://<domaine>/api/model-card | grep -i x-vercel-id

L'identifiant renvoyé commence par le code de région, par exemple
`fra1::...`. S'il commence par `iad1`, le fichier `vercel.json` n'a pas été
pris en compte — vérifier qu'il est bien à la racine du dépôt et que le
déploiement date d'après son ajout.

## Contrainte de plan

Le plan Hobby n'autorise qu'une seule région de fonctions, mais laisse le choix
de laquelle. `fra1` est donc compatible. Sur un plan Pro, on pourrait ajouter
`cdg1` (Paris) pour rapprocher encore le calcul des visiteurs français, à
condition de garder la base dans la même zone.
