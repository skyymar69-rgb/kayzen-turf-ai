# Accessibilite KAYZEN TURF AI

Objectif produit : viser une experience conforme WCAG 2.2 AA, RGAA et European Accessibility Act.

## Fondations implementees

- Mode clair et mode sombre avec preference utilisateur persistante.
- Respect de `prefers-color-scheme` au premier chargement.
- Contrastes renforces sur les surfaces, boutons, tableaux et messages de risque.
- Lien d'evitement "Aller au contenu principal".
- Focus clavier visible sur liens, boutons, champs et listes.
- Cibles interactives principales de 44px minimum.
- Structure semantique avec `main`, titres, tableaux, boutons et liens natifs.
- Libelles `aria-label` et `aria-pressed` sur le changement de theme.
- Respect de `prefers-reduced-motion`.
- Messages jeu responsable visibles et non uniquement codes couleur.

## A auditer avant certification

- Audit WCAG 2.2 AA complet avec lecteur d'ecran.
- Audit RGAA point par point sur les pages publiques et connectees.
- Verification EAA sur les parcours payants : inscription, abonnement, paiement, support, resiliation.
- Tests clavier complets sur desktop et mobile.
- Verification contraste automatisee et manuelle sur toutes les combinaisons theme/composants.
- Tests avec zoom navigateur 200% et reflow mobile.
- Redaction d'une declaration d'accessibilite publique.

Cette page ne vaut pas certification. Elle documente les choix techniques et le backlog necessaire pour une conformite formelle.
