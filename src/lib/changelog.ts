/**
 * Journal des nouveautés, lu par la page publique /nouveautes.
 *
 * Données typées plutôt que lecture de CHANGELOG.md à l'exécution : la page
 * reste statique, sans accès disque sur la plateforme, et une entrée mal formée
 * casse la compilation au lieu de la page. CHANGELOG.md (racine du dépôt) en
 * est la version longue, pour les développeurs ; les deux sont tenus à jour
 * ensemble, du plus récent au plus ancien.
 *
 * Seul ce qu'un visiteur peut constater figure ici : les chantiers internes
 * (CI, scripts, refontes sans effet visible) restent dans CHANGELOG.md.
 */

export type CategorieChangement = "Ajouté" | "Modifié" | "Corrigé" | "Sécurité";

export type EntreeChangelog = {
  /** Date de mise en ligne, AAAA-MM-JJ. */
  date: string;
  titre: string;
  changements: ReadonlyArray<{ categorie: CategorieChangement; elements: readonly string[] }>;
};

export const CHANGELOG: readonly EntreeChangelog[] = [
  {
    date: "2026-10-04",
    titre: "Navigation rapide, page Direct, alertes enrichies et application installable",
    changements: [
      {
        categorie: "Ajouté",
        elements: [
          "Pronostics : barre latérale de navigation par réunion (tiroir sur mobile), filtres, recherche, tri, vue compacte, jour précédent ou suivant, raccourcis clavier et bandeau « prochaine course ».",
          "Page Direct : les courses des 30 prochaines minutes, compte à rebours compris.",
          "Page course : sommaire, course précédente / suivante et carte de la réunion, comparateur de chevaux, cotes de tous les partants sur un graphique, nuage IA × marché, « ce qui a changé depuis votre visite », définitions au survol, partage du ticket en image, arrivée et rapports en tête une fois la course courue.",
          "Accueil : ligne du temps avec curseur « maintenant », vos chevaux suivis du jour, résumé du jour, bilan d'hier, aperçu d'une course au survol et blocs personnalisables.",
          "Alertes sur vos chevaux suivis : smart money, cheval délaissé et arrivée ; historique sur la page « Mes alertes ».",
          "Suivi de performance : courbe de rendement cumulé par signal et graphique de calibration.",
          "Export CSV de l'historique des cotes et des parts de mises d'une course.",
          "Application installable et consultation hors ligne des pages déjà ouvertes.",
          "Barre de navigation basse sur mobile.",
          "Page « État du service » : âge des dernières cotes, date du dernier import du programme, couverture des cotes sur les courses du jour et date du dernier rapport de performance.",
          "Page « Nouveautés », que vous lisez.",
          "Confrontation IA × marché sur chaque course, et lecture des mouvements d'argent (MVT) dans le tableau des partants.",
        ],
      },
      {
        categorie: "Modifié",
        elements: ["Badges de paris et état des courses harmonisés sur l'ensemble du site, en thème clair comme en thème sombre."],
      },
    ],
  },
  {
    date: "2026-10-03",
    titre: "Kayzen Turf, alertes push et analyse de dernière minute",
    changements: [
      {
        categorie: "Ajouté",
        elements: [
          "Le site devient Kayzen Turf.",
          "Bouton « Relancer l'analyse IA » sur chaque course jusqu'au départ, avec le détail de ce qui a changé.",
          "Alertes push sur les chevaux suivis : 30 minutes avant le départ et en cas de non-partant, sans compte ni email.",
          "Classement MVT et argent ; le signal MVT est mesuré dans le suivi de performance.",
        ],
      },
      {
        categorie: "Modifié",
        elements: ["Le site est entièrement gratuit."],
      },
      {
        categorie: "Corrigé",
        elements: ["Rafraîchissement des cotes en continu pendant les heures de course, et alerte quand les données de la veille sont trop anciennes."],
      },
    ],
  },
  {
    date: "2026-10-02",
    titre: "IA sans cote et suivi de performance public",
    changements: [
      {
        categorie: "Ajouté",
        elements: [
          "Une IA qui ne voit jamais la cote, confrontée au marché sur chaque partant.",
          "Profils de partants mesurés (Base, Caché, Value, Favori, Outsider, Tocard, À éviter) et lecture de la course.",
          "Suivi de performance public : réussite et rendement de chaque signal, calculés sur les rapports officiels PMU, même quand ils sont négatifs.",
          "Chevaux suivis, mémorisés dans votre navigateur, avec alerte de départ.",
          "Pronostic gelé avant le départ (H-60, H-15 et dernière minute) pour un suivi honnête.",
        ],
      },
      {
        categorie: "Modifié",
        elements: ["Page course refondue."],
      },
      {
        categorie: "Corrigé",
        elements: [
          "Rapports officiels des réunions régionales désormais pris en compte.",
          "Deux affirmations inexactes de la page Tarifs remplacées par ce qui existe réellement.",
        ],
      },
    ],
  },
  {
    date: "2026-09-04",
    titre: "Plus aucune cote inventée",
    changements: [
      {
        categorie: "Corrigé",
        elements: [
          "Une cote absente n'est plus remplacée par une valeur fabriquée : le site l'affiche comme absente.",
          "Audit complet : modèle, chaîne d'import, sécurité et interface.",
        ],
      },
    ],
  },
  {
    date: "2026-08-30",
    titre: "Cotes plus fraîches",
    changements: [
      {
        categorie: "Ajouté",
        elements: ["Rafraîchissement des cotes avant le départ.", "La sélection passe de 6 à 8 chevaux."],
      },
      {
        categorie: "Corrigé",
        elements: ["Les non-partants sont retirés des pronostics."],
      },
    ],
  },
  {
    date: "2026-08-16",
    titre: "Fiabilité, conformité et performance",
    changements: [
      {
        categorie: "Corrigé",
        elements: [
          "Probabilités cohérentes entre les pages et confiance des tickets exprimée en vraie probabilité.",
          "Arrivée provisoire remplacée par l'arrivée définitive.",
          "Pages plus rapides et mieux indexées (sitemap, robots, rendu incrémental).",
        ],
      },
      {
        categorie: "Sécurité",
        elements: ["Audit de sécurité, de confidentialité (RGPD) et d'accessibilité : premiers correctifs."],
      },
    ],
  },
  {
    date: "2026-05-12",
    titre: "Premières versions publiques",
    changements: [
      {
        categorie: "Ajouté",
        elements: [
          "Programme PMU complet du jour, par réunion et par course.",
          "Téléchargement des pronostics du jour en PDF.",
          "Lexique turf, comparateur de chevaux, favoris et compte à rebours avant le départ.",
        ],
      },
    ],
  },
];
