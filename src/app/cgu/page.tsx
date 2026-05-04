import { LegalPage, editorSection } from "@/components/legal-page";

export default function CguPage() {
  return (
    <LegalPage
      title="Conditions generales d'utilisation"
      intro="Les présentes CGU encadrent l'accès au site Kayzen Pronostic Turf PMU, aux pronostics, analyses, scores et outils d'aide à la décision."
      sections={[
        editorSection,
        {
          title: "Objet du service",
          body: [
            "Le service fournit des analyses de courses hippiques, classements probables, indicateurs de value bet, contenus pédagogiques et simulations. Il ne prend pas de pari pour le compte de l'utilisateur.",
            "Les données affichées peuvent provenir de sources publiques, partenaires ou traitements internes. Elles doivent être vérifiées avant toute décision engageante.",
          ],
        },
        {
          title: "Acces et compte utilisateur",
          body: [
            "Certaines fonctionnalites pourront être gratuites, d'autres réservées aux utilisateurs abonnés. L'utilisateur s'engage a fournir des informations exactes et a conserver la confidentialité de ses identifiants.",
          ],
        },
        {
          title: "Usage interdit",
          body: [
            "Sont interdits : extraction massive non autorisée, contournement des protections techniques, revente non autorisée des données, usage frauduleux, tentative de manipulation de marché ou de promotion d'un jeu irresponsable.",
          ],
        },
        {
          title: "Absence de garantie de gain",
          body: [
            "Les pronostics sont probabilistes. Ils peuvent être erronés, incomplets ou impactés par des informations tardives. L'utilisateur demeure seul responsable de ses mises et de son exposition financière.",
          ],
        },
        {
          title: "Responsabilité",
          body: [
            "Kayzen met en œuvre des moyens raisonnables pour assurer la disponibilité et la qualité du service, sans garantir l’absence d’erreur ni la continuité permanente.",
          ],
        },
      ]}
    />
  );
}
