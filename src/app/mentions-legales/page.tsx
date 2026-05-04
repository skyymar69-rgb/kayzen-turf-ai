import { LegalPage, editorSection } from "@/components/legal-page";
import { COMPANY } from "@/lib/site-config";

export default function MentionsLegalesPage() {
  return (
    <LegalPage
      title="Mentions legales"
      intro="Informations obligatoires d'identification de l'editeur, de l'hebergeur et du responsable du site, conformement a la LCEN et aux recommandations institutionnelles francaises."
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
            "Le site est heberge par Vercel Inc., solution cloud de deploiement d'applications web. Les donnees techniques peuvent etre traitees dans l'Union europeenne ou dans des pays disposant de garanties appropriees selon les services actives.",
          ],
        },
        {
          title: "Propriete intellectuelle",
          body: [
            "Le code source du projet est open source selon la licence du depot. Les marques, textes, interfaces, bases de donnees, modeles, scores et elements distinctifs Kayzen restent proteges par le droit applicable lorsqu'ils ne sont pas expressement places sous licence libre.",
            "Toute reutilisation commerciale de la marque, du nom ou des elements graphiques Kayzen necessite une autorisation ecrite prealable.",
          ],
        },
        {
          title: "Jeu responsable",
          body: [
            "Kayzen Pronostic Turf PMU est un outil d'aide a la decision. Aucun contenu ne constitue une promesse de gain, une garantie de performance ou une incitation au jeu excessif.",
            "Les jeux d'argent comportent des risques : endettement, isolement, dependance. Les utilisateurs doivent rester responsables de leurs decisions et de leur budget.",
          ],
        },
      ]}
    />
  );
}
