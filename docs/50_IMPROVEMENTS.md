# 50 ameliorations visuelles et techniques

Statut : applique = deja integre dans le code ou la documentation. A approfondir = prochain lot necessaire.

## UX / UI

1. Applique - Page d'accueil centree sur le programme PMU par date, reunion et course.
2. Applique - Mode clair et mode sombre global.
3. Applique - Preference de theme persistante.
4. Applique - Respect de la preference systeme au premier chargement.
5. Applique - Synthese de journee : reunions, courses, partants, temps forts.
6. Applique - Filtre rapide des courses par code, nom, discipline ou heure.
7. Applique - Mise en evidence de la course active.
8. Applique - Badges Quinte+, Quarte regional et Pick 5 directement dans le programme.
9. Applique - Bouton d'action unique "Analyser" vers la fiche course.
10. Applique - Fiche course dense de type partants PMU.
11. Applique - Table des chevaux avec casaques, gains, musique et score IA.
12. Applique - Bloc "Lecture rapide" pour comprendre la course sans scroller.
13. Applique - Bloc top chevaux reperes depuis la home.
14. Applique - Layout responsive avec scroll horizontal controle sur tableaux larges.
15. Applique - Contrastes renforces sur fonds clairs et sombres.
16. A approfondir - Ajouter un mode compact / mode confort pour les turfistes intensifs.
17. A approfondir - Ajouter des favoris chevaux / jockeys / reunions.
18. A approfondir - Ajouter une vue calendrier multi-jour.
19. A approfondir - Ajouter des filtres par discipline et type de pari.
20. A approfondir - Ajouter des micro-animations non essentielles et respectueuses de `prefers-reduced-motion`.

## Accessibilite WCAG / RGAA / EAA

21. Applique - Lien d'evitement vers le contenu principal.
22. Applique - Focus clavier visible.
23. Applique - Cibles interactives principales de taille confortable.
24. Applique - `aria-pressed` sur filtres et reunions selectionnees.
25. Applique - `aria-selected` sur onglets de fiche course.
26. Applique - `role=tablist`, `role=tab`, `role=tabpanel` sur la fiche course.
27. Applique - Captions invisibles sur tableaux pour lecteurs d'ecran.
28. Applique - `scope=col` et `scope=row` sur tableaux.
29. Applique - Lignes partants selectionnables au clavier.
30. Applique - Images de casaques avec texte alternatif.
31. Applique - `aria-live` sur date active.
32. Applique - Suppression des icones mal encodees remplacees par libelles robustes.
33. Applique - Documentation d'accessibilite projet.
34. A approfondir - Audit lecteur d'ecran NVDA / VoiceOver.
35. A approfondir - Audit RGAA complet page par page.
36. A approfondir - Declaration d'accessibilite publique.

## Technique / Donnees

37. Applique - Import PMU glissant J-1 / J / J+1.
38. Applique - Calcul des dates d'import en fuseau Europe/Paris.
39. Applique - Base Neon persistante sans retention date limitee.
40. Applique - Courses filtrees sur la France.
41. Applique - Donnees partants enrichies : age, sexe, musique, gains, distance, casaque.
42. Applique - Endpoints API principaux disponibles.
43. Applique - Pages course avec URL dediee et verifiee.
44. Applique - Build Next.js dynamique pour donnees live DB.
45. Applique - Documentation de retention et accessibilite.
46. A approfondir - Ajouter tests unitaires sur mapping PMU.
47. A approfondir - Ajouter tests Playwright sur parcours home -> fiche course.
48. A approfondir - Ajouter monitoring d'import PMU et alertes en cas d'echec.
49. A approfondir - Ajouter validation schema JSON des reponses PMU.
50. A approfondir - Ajouter scoring ML versionne avec evaluation automatique post-course.
