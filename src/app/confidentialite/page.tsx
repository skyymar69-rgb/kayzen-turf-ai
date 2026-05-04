import { LegalPage, editorSection } from "@/components/legal-page";
import { PrivacyForm } from "@/components/privacy-form";

export default function ConfidentialitéPage() {
  return (
    <>
      <LegalPage
        title="Politique de confidentialité RGPD"
        intro="Information des utilisateurs sur les traitements de données personnelles, les bases légales, les durées de conservation et les droits RGPD."
        sections={[
          editorSection,
          {
            title: "Responsable du traitement",
            body: [
              "Le responsable du traitement est KAYZEN LYON. Contact : contact@kayzen-lyon.fr.",
            ],
          },
          {
            title: "Finalités et bases légales",
            body: [
              "Gestion du compte et de l'abonnement : exécution contractuelle. Reponse aux demandes : intérêt légitime ou mesures précontractuelles. Sécurité, logs techniques et prévention de la fraude : intérêt légitime. Prospection : consentement ou intérêt légitime selon le contexte.",
            ],
          },
          {
            title: "Minimisation et conservation",
            body: [
              "Les données collectées doivent être limitées au strict nécessaire. Les données de compte sont conservees pendant la relation contractuelle puis archivees selon les obligations légales. Les données prospects sont conservees pour une durée raisonnable ou jusqu'au retrait du consentement.",
            ],
          },
          {
            title: "Droits des personnes",
            body: [
              "Les utilisateurs disposent des droits d'accès, rectification, effacement, opposition, limitation, portabilite et retrait du consentement. Ils peuvent saisir la CNIL en cas de difficulté.",
            ],
          },
          {
            title: "Sous-traitants et transferts",
            body: [
              "Les sous-traitants techniques peuvent inclure l'hébergeur, la base de données, l'emailing, les paiements et l'analytics. Les transferts hors UE doivent être encadrés par une decision d'adéquation ou des garanties appropriees.",
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
