import { LegalPage, editorSection } from "@/components/legal-page";

export default function AccessibilitePage() {
  return (
    <LegalPage
      title="Accessibilite RGAA, WCAG et European Accessibility Act"
      intro="Engagement de mise en conformite progressive avec le RGAA 4.1.2, les criteres WCAG A/AA et les exigences d'accessibilite applicables aux services numeriques."
      sections={[
        editorSection,
        {
          title: "Referentiel cible",
          body: [
            "Le site vise les criteres RGAA 4.1.2, dont la methode officielle comporte 106 criteres de controle, en correspondance avec les exigences WCAG 2.1 A et AA retenues par la norme europeenne.",
          ],
        },
        {
          title: "Mesures deja integrees",
          body: [
            "Navigation clavier, lien d'evitement, contrastes renforces, textes alternatifs sur les casaques disponibles, boutons tactiles de 44 px minimum, structure semantique avec headings, tableaux avec captions et mode sombre/clair.",
            "Les interfaces mobiles privilegient des cartes lisibles plutot que des tableaux forces, pour reduire le zoom horizontal et ameliorer la comprehension.",
          ],
        },
        {
          title: "Plan d'audit",
          body: [
            "Avant ouverture commerciale, un audit RGAA complet devra etre realise sur un echantillon representatif : accueil, pronostics, page course, paiement, compte utilisateur, formulaires et pages legales.",
          ],
        },
        {
          title: "Contact accessibilite",
          body: [
            "Toute difficulte d'acces peut etre signalee a contact@kayzen-lyon.fr. Une reponse sera apportee dans les meilleurs delais et les correctifs seront priorises selon leur impact utilisateur.",
          ],
        },
      ]}
    />
  );
}
