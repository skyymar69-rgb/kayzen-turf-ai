import type { Metadata } from "next";
import { LegalPage, editorSection } from "@/components/legal-page";
import { PrivacyForm } from "@/components/privacy-form";
import { COMPANY } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    "Traitements de données personnelles opérés par Kayzen Turf AI : bases légales, durées de conservation, sous-traitants et exercice des droits RGPD.",
  alternates: { canonical: "/confidentialite" },
};

/**
 * L'article 13 du RGPD impose une information « concise, transparente et
 * précise ». La rédaction précédente restait au conditionnel — « les
 * sous-traitants **peuvent** inclure l'hébergeur, la base de données,
 * l'emailing, les paiements et l'analytics », « les données sont conservées
 * pour une **durée raisonnable** » — ce qui n'informe de rien : ni le lecteur ni
 * un contrôleur ne peuvent savoir qui traite quoi, ni pendant combien de temps.
 *
 * Les sous-traitants sont désormais nommés, les durées chiffrées, et les
 * traitements qui n'existent pas (emailing, paiement, analytics) sont déclarés
 * comme tels plutôt qu'évoqués au conditionnel.
 */
export default function ConfidentialitePage() {
  return (
    <>
      <LegalPage
        title="Politique de confidentialité RGPD"
        intro="Information des utilisateurs sur les traitements de données personnelles, les bases légales, les durées de conservation et les droits RGPD. Dernière mise à jour : août 2026."
        sections={[
          editorSection,
          {
            title: "Responsable du traitement",
            body: [
              `Le responsable du traitement est ${COMPANY.editor}, ${COMPANY.address}. Toute question relative aux données personnelles peut être adressée à ${COMPANY.email} ou par courrier à cette adresse.`,
              "Aucun délégué à la protection des données (DPO) n'a été désigné : les traitements réalisés ne relèvent d'aucun des cas de désignation obligatoire prévus à l'article 37 du RGPD. Les demandes sont traitées par l'éditeur.",
            ],
          },
          {
            title: "Données réellement collectées",
            body: [
              "Consultation du site : aucun compte n'est requis et aucune donnée de navigation n'est collectée à des fins de mesure d'audience. Aucun cookie publicitaire, aucun traceur tiers et aucun outil d'analytics ne sont déposés.",
              "Préférences locales : le thème d'affichage, le choix relatif aux cookies et les courses mises en favori sont enregistrés dans le stockage local de votre navigateur (localStorage). Ces informations ne quittent jamais votre appareil et ne sont jamais transmises à nos serveurs. Vous pouvez les effacer en vidant les données du site dans votre navigateur.",
              "Demandes d'exercice de droits : le formulaire ci-dessous enregistre votre adresse email, la nature de votre demande et son contenu, à seule fin d'y répondre.",
              "Journaux techniques : l'hébergeur conserve des journaux de connexion (adresse IP, horodatage, URL demandée) nécessaires à la sécurité et au diagnostic. Ils ne sont pas exploités à des fins commerciales.",
            ],
          },
          {
            title: "Finalités, bases légales et durées de conservation",
            body: [
              "Fourniture du service d'information sur les courses : intérêt légitime (art. 6.1.f). Aucune donnée personnelle n'est conservée à ce titre.",
              "Traitement des demandes RGPD : obligation légale (art. 6.1.c, combiné aux art. 15 à 21). Conservation pendant l'instruction, puis archivage 3 ans à titre de preuve du traitement de la demande (art. 5.2).",
              "Sécurité, journaux techniques et prévention de la fraude : intérêt légitime (art. 6.1.f). Conservation 12 mois maximum, conformément à la recommandation de la CNIL sur les journaux applicatifs.",
              "Aucune prospection commerciale, aucun profilage publicitaire et aucune décision automatisée produisant des effets juridiques à l'égard des personnes ne sont mis en œuvre.",
            ],
          },
          {
            title: "Sous-traitants et transferts hors UE",
            body: [
              "Hébergement de l'application : Vercel Inc. Le déploiement est configuré sur une région européenne. Vercel Inc. étant établie aux États-Unis, un transfert reste possible pour l'exploitation et le support ; il est encadré par les clauses contractuelles types de la Commission européenne et par la certification EU-US Data Privacy Framework.",
              "Base de données : Neon Inc., instance hébergée dans l'Union européenne, encadrée par les clauses contractuelles types.",
              "Données publiques des courses : les programmes, partants et cotes proviennent des services du PMU. Ce sont des données sportives publiques, sans caractère personnel au sens du RGPD.",
              "Aucun autre sous-traitant n'intervient : ni prestataire d'emailing, ni prestataire de paiement, ni régie publicitaire, ni outil de mesure d'audience.",
            ],
          },
          {
            title: "Droits des personnes",
            body: [
              "Vous disposez des droits d'accès, de rectification, d'effacement, d'opposition, de limitation du traitement, de portabilité, ainsi que du droit de retirer votre consentement à tout moment (art. 15 à 21 du RGPD).",
              "Ces droits s'exercent via le formulaire ci-dessous, qui enregistre votre demande et vous en communique la référence, ou directement par email à " + COMPANY.email + ". Une réponse vous est adressée sous un mois au maximum (art. 12.3), délai prolongeable de deux mois pour les demandes complexes, auquel cas vous en êtes informé.",
              "Si la réponse ne vous satisfait pas, vous pouvez introduire une réclamation auprès de la Commission nationale de l'informatique et des libertés (CNIL), 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07, ou en ligne sur cnil.fr.",
            ],
          },
          {
            title: "Sécurité et minimisation",
            body: [
              "Les échanges sont chiffrés en HTTPS avec HSTS. Les en-têtes de sécurité (Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) restreignent les ressources chargées et les capacités du navigateur.",
              "La collecte est limitée au strict nécessaire (art. 5.1.c) : aucun champ facultatif de confort, aucun enrichissement, aucun recoupement avec des bases tierces.",
            ],
          },
          {
            title: "Mineurs",
            body: [
              "Le service porte sur les paris hippiques et s'adresse exclusivement aux personnes majeures (code de la sécurité intérieure, art. L. 320-8). Aucune donnée n'est sciemment collectée auprès de mineurs. Toute donnée identifiée comme telle est supprimée sans délai sur simple signalement.",
            ],
          },
        ]}
      />
      <section className="-mt-8 px-3 pb-12 sm:px-5 lg:px-8" id="conservation">
        <div className="mx-auto max-w-[1120px]">
          <PrivacyForm />
        </div>
      </section>
    </>
  );
}
