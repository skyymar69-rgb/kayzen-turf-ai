import { LegalPage, editorSection } from "@/components/legal-page";
import { PrivacyForm } from "@/components/privacy-form";

export default function ConfidentialitePage() {
  return (
    <>
      <LegalPage
        title="Politique de confidentialite RGPD"
        intro="Information des utilisateurs sur les traitements de donnees personnelles, les bases legales, les durees de conservation et les droits RGPD."
        sections={[
          editorSection,
          {
            title: "Responsable du traitement",
            body: [
              "Le responsable du traitement est KAYZEN LYON. Contact : contact@kayzen-lyon.fr.",
            ],
          },
          {
            title: "Finalites et bases legales",
            body: [
              "Gestion du compte et de l'abonnement : execution contractuelle. Reponse aux demandes : interet legitime ou mesures precontractuelles. Securite, logs techniques et prevention de la fraude : interet legitime. Prospection : consentement ou interet legitime selon le contexte.",
            ],
          },
          {
            title: "Minimisation et conservation",
            body: [
              "Les donnees collectees doivent etre limitees au strict necessaire. Les donnees de compte sont conservees pendant la relation contractuelle puis archivees selon les obligations legales. Les donnees prospects sont conservees pour une duree raisonnable ou jusqu'au retrait du consentement.",
            ],
          },
          {
            title: "Droits des personnes",
            body: [
              "Les utilisateurs disposent des droits d'acces, rectification, effacement, opposition, limitation, portabilite et retrait du consentement. Ils peuvent saisir la CNIL en cas de difficulte.",
            ],
          },
          {
            title: "Sous-traitants et transferts",
            body: [
              "Les sous-traitants techniques peuvent inclure l'hebergeur, la base de donnees, l'emailing, les paiements et l'analytics. Les transferts hors UE doivent etre encadres par une decision d'adequation ou des garanties appropriees.",
            ],
          },
        ]}
      />
      <section className="-mt-8 px-3 pb-12 sm:px-5 lg:px-8">
        <div className="mx-auto max-w-[1120px]">
          <PrivacyForm />
        </div>
      </section>
    </>
  );
}
