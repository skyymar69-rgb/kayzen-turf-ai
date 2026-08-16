// Source unique du domaine : `@/lib/site`. Ce ré-export évite qu'une seconde
// constante en dur ne diverge du sitemap et des canonicals.
import { SITE_URL } from "@/lib/site";

export { SITE_URL };

export const COMPANY = {
  brand: "Kayzen Pronostic Turf PMU",
  editor: "KAYZEN LYON",
  legalForm: "SASU",
  siren: "999 418 346 000 14",
  rcs: "Lyon - 999 418 346",
  vat: "FR85 999 418 346",
  ape: "4791B",
  address: "6, rue Pierre TERMIER 69009 LYON",
  phone: "+33 (0)4 87 77 68 61",
  email: "contact@kayzen-lyon.fr",
  agency: "Kayzen Web",
  agencyUrl: "https://internet.kayzen-lyon.fr",
};

export const CONTACT_LINKS = {
  site: SITE_URL,
  maps: "https://www.google.com/maps/search/?api=1&query=6%20rue%20Pierre%20Termier%2069009%20Lyon",
  reviews: "https://www.google.com/search?q=KAYZEN%20LYON%20avis",
  vcard: "/kayzen-contact.vcf",
};

/**
 * Sources réglementaires citées en bas des pages légales.
 *
 * Trois de ces liens étaient morts : une passe d'accentuation avait réécrit les
 * noms de domaine eux-mêmes. `accèssibilité.numérique.gouv.fr` ne résout pas en
 * DNS, `cnil.fr/fr/données-personnelles` répond 404, et le chemin France Num
 * accentué était introuvable. Un site qui cite ses sources et pointe vers des
 * pages inexistantes affaiblit précisément ce qu'il cherche à démontrer.
 *
 * Toutes les URL ci-dessous ont été vérifiées en HTTP 200.
 */
export const LEGAL_SOURCES = [
  {
    label: "Service-Public Entreprendre — mentions obligatoires",
    href: "https://entreprendre.service-public.gouv.fr/vosdroits/F37351",
  },
  {
    label: "CNIL — cookies et traceurs",
    href: "https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies",
  },
  {
    label: "CNIL — données personnelles",
    href: "https://www.cnil.fr/fr/donnees-personnelles",
  },
  {
    label: "CNIL — comprendre le RGPD",
    href: "https://www.cnil.fr/fr/comprendre-le-rgpd",
  },
  {
    label: "RGAA 4.1.2 — référentiel d'accessibilité",
    href: "https://accessibilite.numerique.gouv.fr/",
  },
  {
    label: "France Num — accessibilité des sites e-commerce",
    href: "https://www.francenum.gouv.fr/guides-et-conseils/developpement-commercial/site-e-commerce/accessibilite-des-sites-de-e-commerce",
  },
  {
    label: "DGCCRF — conditions générales de vente",
    href: "https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/conditions-generales-de-vente-quelles-mentions-sont-obligatoires",
  },
  {
    label: "Joueurs Info Service — jeu responsable",
    href: "https://www.joueurs-info-service.fr",
  },
];
