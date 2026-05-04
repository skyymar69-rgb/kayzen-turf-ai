import { LegalPage, editorSection } from "@/components/legal-page";

export default function CookiesPage() {
  return (
    <LegalPage
      title="Politique cookies"
      intro="Cette page detaille les traceurs utilises, la base juridique et les choix de consentement proposes a l'utilisateur."
      sections={[
        editorSection,
        {
          title: "Principe",
          body: [
            "Les cookies strictement necessaires au fonctionnement du site peuvent etre deposes sans consentement. Les cookies de mesure d'audience, personnalisation ou marketing sont soumis au consentement prealable lorsqu'ils ne beneficient pas d'une exemption.",
          ],
        },
        {
          title: "Cookies actuellement prevus",
          body: [
            "kayzen-cookie-choice : conservation locale du choix de consentement cookies. Finalite : memoriser le choix utilisateur. Duree : jusqu'a suppression par l'utilisateur.",
            "Aucun cookie publicitaire n'est active par defaut dans la version actuelle.",
          ],
        },
        {
          title: "Gestion du consentement",
          body: [
            "L'utilisateur peut accepter, refuser ou personnaliser les cookies depuis le bandeau. Un refus doit etre aussi simple qu'une acceptation.",
          ],
        },
      ]}
    />
  );
}
