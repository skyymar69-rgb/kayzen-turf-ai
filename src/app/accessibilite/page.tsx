import type { Metadata } from "next";
import { LegalPage, editorSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Déclaration d'accessibilité",
  description: "Niveau de conformité RGAA 4.1.2 et WCAG 2.1 AA du site PronoTurf, dérogations connues et moyen de signaler un défaut d'accessibilité.",
  alternates: { canonical: "/accessibilite" },
};

export default function AccessibilitePage() {
  return (
    <LegalPage
      title="Accessibilité RGAA, WCAG et European Accessibility Act"
      intro="Engagement de mise en conformité progressive avec le RGAA 4.1.2, les critères WCAG A/AA et les exigences d'accessibilité applicables aux services numériques."
      sections={[
        editorSection,
        {
          title: "Référentiel cible",
          body: [
            "Le site vise les critères RGAA 4.1.2, dont la méthode officielle comporte 106 critères de contrôle, en correspondance avec les exigences WCAG 2.1 A et AA retenues par la norme européenne.",
          ],
        },
        {
          title: "Mesures déjà intégrées",
          body: [
            "Navigation clavier, lien d'évitement, contrastes renforcés, textes alternatifs sur les casaques disponibles, boutons tactiles de 44 px minimum, structure sémantique avec headings, tableaux avec captions et mode sombre/clair.",
            "Les interfaces mobiles privilégient des cartes lisibles plutôt que des tableaux forcés, pour réduire le zoom horizontal et améliorer la compréhension.",
          ],
        },
        {
          title: "Plan d'audit",
          body: [
            "Avant ouverture commerciale, un audit RGAA complet devra être réalisé sur un échantillon représentatif : accueil, pronostics, page course, paiement, compte utilisateur, formulaires et pages légales.",
          ],
        },
        {
          title: "Contact accessibilité",
          body: [
            "Toute difficulté d'accès peut être signalée à contact@kayzen-lyon.fr. Une réponse sera apportée dans les meilleurs délais et les correctifs seront priorisés selon leur impact utilisateur.",
          ],
        },
      ]}
    />
  );
}
