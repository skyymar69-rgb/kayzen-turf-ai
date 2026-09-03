import type { Metadata } from "next";
import { LegalPage, editorSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Politique cookies",
  description: "Traceurs déposés par PronoTurf, base juridique, durées de conservation et moyen de retirer son consentement à tout moment.",
  alternates: { canonical: "/cookies" },
};

export default function CookiesPage() {
  return (
    <LegalPage
      title="Politique cookies"
      intro="Cette page détaille les traceurs utilisés, la base juridique et les choix de consentement proposés à l'utilisateur."
      sections={[
        editorSection,
        {
          title: "Principe",
          body: [
            "Les cookies strictement nécessaires au fonctionnement du site peuvent être déposés sans consentement. Les cookies de mesure d'audience, personnalisation ou marketing sont soumis au consentement préalable lorsqu'ils ne bénéficient pas d'une exemption.",
          ],
        },
        {
          title: "Traceurs actuellement utilisés",
          body: [
            "Le site ne dépose aucun cookie. Il utilise uniquement le stockage local du navigateur (localStorage), pour trois informations strictement nécessaires au fonctionnement du service, exemptées de consentement :",
            "kayzen-cookie-choice : conservation locale du choix de consentement. Finalité : mémoriser la réponse donnée au bandeau. Durée : jusqu'à suppression par l'utilisateur ou clic sur « Gérer les cookies ».",
            "kayzen-theme : préférence d'affichage (thème clair ou sombre). Finalité : conserver le thème choisi d'une visite à l'autre. Durée : jusqu'à suppression par l'utilisateur.",
            "kz-favorites : liste des courses marquées en favori. Finalité : retrouver ses courses suivies. Durée : jusqu'à suppression par l'utilisateur. Ces données ne quittent pas le navigateur.",
            "Aucun cookie de mesure d'audience, publicitaire ou de réseau social n'est activé dans la version actuelle.",
          ],
        },
        {
          title: "Gestion du consentement",
          body: [
            "Le bandeau propose deux choix : accepter ou refuser. Un refus est aussi simple qu'une acceptation, et n'a aucun effet sur l'accès au site.",
            "Le choix peut être retiré à tout moment : le lien « Gérer les cookies », en pied de page, efface la réponse enregistrée et affiche à nouveau le bandeau.",
          ],
        },
      ]}
    />
  );
}
