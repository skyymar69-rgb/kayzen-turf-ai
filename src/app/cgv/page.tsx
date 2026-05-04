import { LegalPage, editorSection } from "@/components/legal-page";

export default function CgvPage() {
  return (
    <LegalPage
      title="Conditions generales de vente"
      intro="Les presentes CGV structurent le futur modele SaaS payant : abonnements, services numeriques, API et offres B2B."
      sections={[
        editorSection,
        {
          title: "Produits et services",
          body: [
            "Kayzen pourra commercialiser des abonnements d'acces aux pronostics premium, alertes, tableaux de bord, API et services B2B. Les caracteristiques essentielles seront presentees avant paiement.",
          ],
        },
        {
          title: "Prix et paiement",
          body: [
            "Les prix seront indiques en euros toutes taxes comprises pour les consommateurs et, le cas echeant, hors taxes pour les professionnels. Le paiement sera realise via un prestataire securise.",
          ],
        },
        {
          title: "Abonnement et resiliation",
          body: [
            "Les abonnements pourront etre mensuels ou annuels. Les modalites de renouvellement, resiliation et eventuelle periode d'essai devront etre precisees dans l'ecran de paiement.",
          ],
        },
        {
          title: "Droit de retractation",
          body: [
            "Pour les contenus et services numeriques fournis immediatement, l'execution avant la fin du delai de retractation pourra necessiter l'accord prealable du client et sa renonciation expresse au droit de retractation, lorsque la loi le permet.",
          ],
        },
        {
          title: "Mediation et reclamations",
          body: [
            "Toute reclamation peut etre adressee a contact@kayzen-lyon.fr. Pour les consommateurs, un mediateur de la consommation devra etre designe avant ouverture commerciale effective.",
          ],
        },
      ]}
    />
  );
}
