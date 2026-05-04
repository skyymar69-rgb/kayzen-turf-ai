import { LegalPage, editorSection } from "@/components/legal-page";

export default function AccessibilitéPage() {
  return (
    <LegalPage
      title="Accessibilité RGAA, WCAG et European Accessibility Act"
      intro="Engagement de mise en conformité progressive avec le RGAA 4.1.2, les critères WCAG A/AA et les exigences d'accèssibilité applicables aux services numériques."
      sections={[
        editorSection,
        {
          title: "Referentiel cible",
          body: [
            "Le site vise les critères RGAA 4.1.2, dont la methode officielle comporte 106 critères de controle, en correspondance avec les exigences WCAG 2.1 A et AA retenues par la norme européenne.",
          ],
        },
        {
          title: "Mesures deja integrees",
          body: [
            "Navigation clavier, lien d'evitement, contrastes renforces, textes alternatifs sur les casaques disponibles, boutons tactiles de 44 px minimum, structure semantique avec headings, tableaux avec captions et mode sombre/clair.",
            "Les interfaces mobiles privilegient des cartes lisibles plutot que des tableaux forces, pour reduire le zoom horizontal et améliorer la comprehension.",
          ],
        },
        {
          title: "Plan d'audit",
          body: [
            "Avant ouverture commerciale, un audit RGAA complet devra être réalisé sur un echantillon représentatif : accueil, pronostics, page course, paiement, compte utilisateur, formulaires et pages légales.",
          ],
        },
        {
          title: "Contact accèssibilité",
          body: [
            "Toute difficulté d'accès peut être signalée a contact@kayzen-lyon.fr. Une réponse sera apportée dans les meilleurs délais et les correctifs seront priorisés selon leur impact utilisateur.",
          ],
        },
      ]}
    />
  );
}
