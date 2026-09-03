import type { Metadata } from "next";
import { LegalPage, editorSection } from "@/components/legal-page";
import { COMPANY } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Éditeur, directeur de la publication, hébergeur et coordonnées du site PronoTurf, conformément à la LCEN.",
  alternates: { canonical: "/mentions-legales" },
};

export default function MentionsLegalesPage() {
  return (
    <LegalPage
      title="Mentions légales"
      intro="Informations obligatoires d’identification de l’éditeur, de l’hébergeur et du responsable du site, conformément à la LCEN et aux recommandations institutionnelles françaises."
      sections={[
        editorSection,
        {
          title: "Directeur de la publication",
          body: [
            `Le directeur de la publication est le représentant légal de ${COMPANY.editor}, sauf désignation contraire ultérieure.`,
          ],
        },
        {
          title: "Hébergement",
          body: [
            "Le site est hébergé par Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis — site : https://vercel.com — contact : https://vercel.com/contact (l'hébergeur ne publie pas de numéro de téléphone).",
            "Les données techniques peuvent être traitées dans l'Union européenne ou dans des pays disposant de garanties appropriées selon les services activés.",
          ],
        },
        {
          title: "Propriété intellectuelle",
          body: [
            "Le code source du projet est open source selon la licence du dépôt. Les marques, textes, interfaces, bases de données, modèles, scores et éléments distinctifs PronoTurf restent protégés par le droit applicable lorsqu'ils ne sont pas expressément placés sous licence libre.",
            "Toute réutilisation commerciale de la marque, du nom ou des éléments graphiques PronoTurf nécessite une autorisation écrite préalable.",
          ],
        },
        {
          title: "Jeu responsable",
          body: [
            "PronoTurf est un outil d'aide à la décision. Aucun contenu ne constitue une promesse de gain, une garantie de performance ou une incitation au jeu excessif.",
            "Les jeux d’argent comportent des risques : endettement, isolement, dépendance. Les utilisateurs doivent rester responsables de leurs décisions et de leur budget.",
          ],
        },
      ]}
    />
  );
}
