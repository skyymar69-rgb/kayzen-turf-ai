import type { Metadata } from "next";
import { LegalPage, editorSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Conditions générales de vente",
  description: "Abonnements, prix, paiement, durée, résiliation et droit de rétractation applicables aux offres payantes Kayzen Turf.",
  alternates: { canonical: "/cgv" },
};

export default function CgvPage() {
  return (
    <LegalPage
      title="Conditions générales de vente"
      intro="Kayzen Turf est aujourd’hui entièrement gratuit et ne vend aucun abonnement. Les présentes CGV ne s’appliqueront qu’à une éventuelle offre payante future (API, services B2B), dont les conditions seraient présentées avant tout paiement."
      sections={[
        editorSection,
        {
          title: "Produits et services",
          body: [
            "Kayzen Turf pourra commercialiser des abonnements d'accès aux pronostics premium, alertes, tableaux de bord, API et services B2B. Les caractéristiques essentielles seront présentées avant paiement.",
          ],
        },
        {
          title: "Prix et paiement",
          body: [
            "Les prix seront indiqués en euros toutes taxes comprises pour les consommateurs et, le cas échéant, hors taxes pour les professionnels. Le paiement sera réalisé via un prestataire sécurisé.",
          ],
        },
        {
          title: "Abonnement et résiliation",
          body: [
            "Les abonnements pourront être mensuels ou annuels. Les modalités de renouvellement, résiliation et éventuelle période d'essai devront être précisées dans l'écran de paiement.",
          ],
        },
        {
          title: "Droit de rétractation",
          body: [
            "Pour les contenus et services numériques fournis immédiatement, l'exécution avant la fin du délai de rétractation pourra nécessiter l'accord préalable du client et sa renonciation expresse au droit de rétractation, lorsque la loi le permet.",
          ],
        },
        {
          title: "Médiation et réclamations",
          body: [
            "Toute réclamation peut être adressée à contact@kayzen-lyon.fr. Pour les consommateurs, un médiateur de la consommation devra être désigné avant ouverture commerciale effective.",
          ],
        },
      ]}
    />
  );
}
