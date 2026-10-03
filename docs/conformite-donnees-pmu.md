# Données PMU : conditions d'utilisation et risque juridique

Recherche documentaire du 03/10/2026. Ce n'est pas un avis d'avocat ; c'est la
base pour décider, et pour briefer un conseil si besoin.

## Ce que dit le PMU

- Mentions légales du groupe PMU (entreprise.pmu.fr) : reproduction et
  publication interdites sans autorisation écrite préalable ; toute
  exploitation non autorisée est traitée comme une contrefaçon (CPI,
  art. L.335-2 et suivants).
- Conditions générales du compte PMU+ (homologuées par l'ANJ, décision
  2025-PR-087) : le PMU se dit propriétaire ou concessionnaire des droits sur
  les données ; usage limité aux besoins propres du parieur ; reproduction en
  nombre interdite, à des fins lucratives ou non.
- Aucune CGU propre à l'API turfinfo n'a été trouvée. Les API sont non
  documentées et réservées au PMU et à ses partenaires.
- Pas d'offre publique de licence de données hippiques. « PMU PLAY » (flux XML)
  couvre les paris sportifs, pas les courses, et reste réservé aux partenaires.

## Jurisprudence

- **TGI Paris, 20 juin 2007, PMU c. Eturf** : le PMU est reconnu producteur de
  la base « Infocentre » (programmes, partants, cotes, rapports ; environ
  4,4 M€ d'investissement). Eturf a été condamné pour extraction d'une partie
  substantielle de cette base, repérée grâce à des erreurs glissées
  volontairement par le PMU : 120 000 € de dommages-intérêts et une astreinte.
- **CJCE, 9 nov. 2004, C-203/02, BHB c. William Hill** : l'investissement pour
  créer les données (listes de partants) n'est pas protégé, ce qui sert
  l'argument d'un site comme le nôtre. En revanche, des extractions répétées
  et systématiques de petites parties sont interdites si elles reconstituent
  une partie substantielle de la base. C'est le cas d'une collecte continue
  de toutes les courses.

## Lecture pour PronoTurf

| Point | Évaluation |
| --- | --- |
| Procès à court terme | Peu probable : de nombreux sites gratuits utilisent ces API. |
| Fondement juridique contre nous | Réel : droit sui generis, précédent Eturf, base piégée. |
| Scénario le plus probable | Mise en demeure ou blocage technique (adresses IP, endpoints modifiés). |
| Effet de la gratuité | Réduit le préjudice, ne supprime pas l'atteinte. |
| Ce qui aggraverait le risque | Toute monétisation : abonnement, affiliation, API B2B. |
| Vente de pronostics (loi du 2 juin 1891) | Non concernée tant que le site est gratuit. |
| Publicité pour les jeux (CSI L.320-12, D.320-2) | Non concernée sans affiliation ni lien vers un opérateur. |
| Promesse de gain (C. conso L.121-4) | Vérifié le 03/10/2026 : aucune formulation trompeuse sur le site. |

## Actions

Faites :
- Site gratuit, sans publicité ni affiliation (03/10/2026).
- Aucune promesse de gain ; rendement publié même négatif.
- Message jeu responsable et Joueurs Info Service présents (page
  /jeu-responsable, pied de page, /tarifs).

À décider (Tarek) :
1. **Citer la source** sur les pages course et en pied de page : « Données :
   PMU, France Galop, LeTrot ». Cela ne crée aucun droit, mais montre la
   bonne foi.
2. **Réduire l'empreinte de la collecte** : ne plus republier intégralement
   les rapports définitifs et les parts de pool, renvoyer vers pmu.fr pour
   les rapports, et identifier le robot par un User-Agent avec contact. Coût :
   le suivi de performance et le Money Flow reposent sur ces données ; il
   faudrait les garder en interne et n'afficher que des agrégats.
3. **Casaques** : les servir depuis un cache local avec mention de la source,
   plutôt qu'en lien direct vers assets.racingdata.pmu.fr.
4. **Écrire au PMU** (direction juridique ou partenariats) pour demander une
   autorisation, et le faire obligatoirement avant l'API B2B prévue dans trois
   mois, et avant toute affiliation.
5. **Plan B** : garder séparées les données propres à PronoTurf (modèle,
   analyses, pronostics gelés) et les données brutes du PMU, pour pouvoir
   changer de source.

## Sources

- entreprise.pmu.fr/privacy-policy (mentions légales du groupe)
- ANJ, décision 2025-PR-087, conditions générales PMU homologuées
- legalis.net : TGI Paris, 3e ch., 20 juin 2007, PMU c. Eturf
- CJCE, C-203/02, 9 novembre 2004 (texte intégral)
- Légifrance : loi du 2 juin 1891, art. 4 ; CSI L.324-1
- ANJ : lignes directrices sur la publicité (2022)
- pmu-partner-xml.com ; rs2i.fr/pmu
- Inaccessibles lors de la recherche : pmu.fr/mentions-legales (404), forum
  PMU « API de PMU.fr » (402), tds-fr.net (certificat)
