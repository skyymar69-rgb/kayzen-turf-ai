import { LegalPage, editorSection } from "@/components/legal-page";

export default function CguPage() {
  return (
    <LegalPage
      title="Conditions generales d'utilisation"
      intro="Les presentes CGU encadrent l'acces au site Kayzen Pronostic Turf PMU, aux pronostics, analyses, scores et outils d'aide a la decision."
      sections={[
        editorSection,
        {
          title: "Objet du service",
          body: [
            "Le service fournit des analyses de courses hippiques, classements probables, indicateurs de value bet, contenus pedagogiques et simulations. Il ne prend pas de pari pour le compte de l'utilisateur.",
            "Les donnees affichees peuvent provenir de sources publiques, partenaires ou traitements internes. Elles doivent etre verifiees avant toute decision engageante.",
          ],
        },
        {
          title: "Acces et compte utilisateur",
          body: [
            "Certaines fonctionnalites pourront etre gratuites, d'autres reservees aux utilisateurs abonnes. L'utilisateur s'engage a fournir des informations exactes et a conserver la confidentialite de ses identifiants.",
          ],
        },
        {
          title: "Usage interdit",
          body: [
            "Sont interdits : extraction massive non autorisee, contournement des protections techniques, revente non autorisee des donnees, usage frauduleux, tentative de manipulation de marche ou de promotion d'un jeu irresponsable.",
          ],
        },
        {
          title: "Absence de garantie de gain",
          body: [
            "Les pronostics sont probabilistes. Ils peuvent etre errones, incomplets ou impactes par des informations tardives. L'utilisateur demeure seul responsable de ses mises et de son exposition financiere.",
          ],
        },
        {
          title: "Responsabilite",
          body: [
            "Kayzen met en oeuvre des moyens raisonnables pour assurer la disponibilite et la qualite du service, sans garantir l'absence d'erreur ni la continuite permanente.",
          ],
        },
      ]}
    />
  );
}
