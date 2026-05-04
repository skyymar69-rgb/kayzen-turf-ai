import { LegalPage, editorSection } from "@/components/legal-page";

export default function CookiesPage() {
  return (
    <LegalPage
      title="Politique cookies"
      intro="Cette page détaille les traceurs utilisés, la base juridique et les choix de consentement proposés a l'utilisateur."
      sections={[
        editorSection,
        {
          title: "Principe",
          body: [
            "Les cookies strictement nécessaires au fonctionnement du site peuvent être déposés sans consentement. Les cookies de mesure d'audience, personnalisation ou marketing sont soumis au consentement préalable lorsqu'ils ne bénéficient pas d'une exemption.",
          ],
        },
        {
          title: "Cookies actuellement prévus",
          body: [
            "kayzen-cookie-choice : conservation locale du choix de consentement cookies. Finalité : mémoriser le choix utilisateur. Durée : jusqu'a suppression par l'utilisateur.",
            "Aucun cookie publicitaire n'est active par défaut dans la version actuelle.",
          ],
        },
        {
          title: "Gestion du consentement",
          body: [
            "L'utilisateur peut accepter, refuser ou personnaliser les cookies depuis le bandeau. Un refus doit être aussi simple qu'une acceptation.",
          ],
        },
      ]}
    />
  );
}
