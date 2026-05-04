import { LegalPage, editorSection } from "@/components/legal-page";
import { COMPANY } from "@/lib/site-config";

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
            `Le directeur de la publication est le representant legal de ${COMPANY.editor}, sauf designation contraire ulterieure.`,
          ],
        },
        {
          title: "Hebergement",
          body: [
            "Le site est hébergé par Vercel Inc., solution cloud de déploiement d'applications web. Les données techniques peuvent être traitées dans l'Union européenne ou dans des pays disposant de garanties appropriees selon les services activés.",
          ],
        },
        {
          title: "Propriete intellectuelle",
          body: [
            "Le code source du projet est open source selon la licence du dépôt. Les marques, textes, interfaces, bases de données, modèles, scores et éléments distinctifs Kayzen restent protégés par le droit applicable lorsqu'ils ne sont pas expressément placés sous licence libre.",
            "Toute réutilisation commerciale de la marque, du nom ou des éléments graphiques Kayzen nécessite une autorisation écrite préalable.",
          ],
        },
        {
          title: "Jeu responsable",
          body: [
            "Kayzen Pronostic Turf PMU est un outil d'aide à la décision. Aucun contenu ne constitue une promesse de gain, une garantie de performance ou une incitation au jeu excessif.",
            "Les jeux d’argent comportent des risques : endettement, isolement, dépendance. Les utilisateurs doivent rester responsables de leurs décisions et de leur budget.",
          ],
        },
      ]}
    />
  );
}
