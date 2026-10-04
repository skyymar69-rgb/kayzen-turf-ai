import Link from "next/link";
import type { Metadata } from "next";
import { Activity, ArrowLeft, FlaskConical } from "lucide-react";
import { getEtatDonnees, type EtatDonnees } from "@/lib/race-repository";

export const metadata: Metadata = {
  title: "État du service — fraîcheur des données",
  description:
    "Âge des dernières cotes, date du dernier import du programme PMU, couverture des cotes sur les courses du jour et date du dernier rapport de performance de Kayzen Turf.",
  alternates: { canonical: "/etat" },
};

/** Une minute : la boucle live rafraîchit les cotes jusqu'à toutes les 45 s. */
export const revalidate = 60;

/**
 * Écart normal maximal entre deux imports planifiés (04:30, 10:30, 17:30 UTC) :
 * 11 h de 17:30 à 04:30. Au-delà de 12 h, un import a manqué.
 */
const IMPORT_EN_RETARD_MS = 12 * 3_600_000;
/** Rapport régénéré chaque nuit à 23:15 UTC : au-delà de 36 h, une nuit a sauté. */
const RAPPORT_EN_RETARD_MS = 36 * 3_600_000;

const heureParis = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });

function age(iso: string, maintenant: number): string {
  const minutes = Math.max(0, Math.round((maintenant - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.round(minutes / 60);
  if (heures < 48) return `il y a ${heures} h`;
  return `il y a ${Math.round(heures / 24)} jours`;
}

type Ligne = { titre: string; valeur: string; detail: string; alerte?: boolean };

function lignes(etat: Extract<EtatDonnees, { mode: "connecte" }>, maintenant: number): Ligne[] {
  const { dernierImport, dernieresCotes, coursesDuJour, coursesDuJourAvecCotes, dernierRapportPerformance } = etat;
  const ecart = (iso: string | null) => (iso ? maintenant - new Date(iso).getTime() : Infinity);
  const couverture = coursesDuJour > 0 ? Math.round((coursesDuJourAvecCotes / coursesDuJour) * 100) : null;

  return [
    {
      titre: "Dernières cotes relevées",
      valeur: dernieresCotes ? `${heureParis(dernieresCotes)} (${age(dernieresCotes, maintenant)})` : "Aucun relevé récent",
      detail:
        "Les cotes ne sont rafraîchies que pour les courses qui partent dans les 90 minutes. Hors des heures de course, une cote vieille de plusieurs heures est normale.",
    },
    {
      titre: "Dernier import du programme PMU",
      valeur: dernierImport ? `${heureParis(dernierImport)} (${age(dernierImport, maintenant)})` : "Aucun import depuis 7 jours",
      detail:
        ecart(dernierImport) > IMPORT_EN_RETARD_MS
          ? "En retard : trois imports sont planifiés chaque jour, l'un d'eux a manqué. Le programme affiché peut être incomplet."
          : "Trois imports planifiés par jour (6 h 30, 12 h 30 et 19 h 30, heure d'été), pour la veille, le jour et le lendemain.",
      alerte: ecart(dernierImport) > IMPORT_EN_RETARD_MS,
    },
    {
      titre: "Courses du jour avec cotes",
      valeur:
        coursesDuJour > 0
          ? `${coursesDuJourAvecCotes} sur ${coursesDuJour} course${coursesDuJour > 1 ? "s" : ""} (${couverture} %)`
          : "Aucune course importée pour aujourd'hui",
      detail:
        "Une course sans cote n'a pas encore de marché ouvert, ou le PMU ne l'a pas publiée. Une cote absente reste absente : elle n'est jamais remplacée par une estimation.",
      alerte: coursesDuJour === 0,
    },
    {
      titre: "Dernier rapport de suivi de performance",
      valeur: dernierRapportPerformance
        ? `${heureParis(dernierRapportPerformance)} (${age(dernierRapportPerformance, maintenant)})`
        : "Aucun rapport publié",
      detail:
        ecart(dernierRapportPerformance) > RAPPORT_EN_RETARD_MS
          ? "En retard : le rapport est régénéré chaque nuit, la dernière génération a manqué."
          : "Régénéré chaque nuit à partir des rapports officiels PMU.",
      alerte: ecart(dernierRapportPerformance) > RAPPORT_EN_RETARD_MS,
    },
  ];
}

function Encadre({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 rounded-2xl border border-warn/30 bg-warn-lo p-5 text-fg">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <FlaskConical aria-hidden="true" className="text-warn" size={18} /> {titre}
      </h2>
      <div className="mt-2 space-y-2 text-sm leading-6">{children}</div>
    </section>
  );
}

export default async function EtatPage() {
  const etat = await getEtatDonnees();

  return (
    <main className="min-h-screen bg-bg pb-20" id="contenu-principal">
      <div className="mx-auto max-w-3xl px-4 pt-6 sm:px-6 lg:px-8">
        <Link
          className="mb-6 inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm font-medium text-muted shadow-sm transition hover:border-accent hover:text-accent-text"
          href="/"
        >
          <ArrowLeft aria-hidden="true" size={14} /> Accueil
        </Link>

        <header>
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-accent-text">
            <Activity aria-hidden="true" size={16} /> Transparence
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-fg sm:text-4xl">État du service</h1>
          <p className="mt-3 text-base leading-7 text-muted">
            La fraîcheur des données qui alimentent les pronostics. Un pronostic ne vaut que ce que valent ses
            données : si l&apos;une d&apos;elles est en retard, cette page le dit.
          </p>
        </header>

        {etat.mode === "demonstration" && (
          <Encadre titre="Mode démonstration">
            <p>
              Aucune source de données n&apos;est connectée à cette instance du site. Les courses affichées sont
              fictives : il n&apos;y a ni import du programme PMU, ni relevé de cotes, ni rapport de performance à
              dater.
            </p>
          </Encadre>
        )}

        {etat.mode === "indisponible" && (
          <Encadre titre="Base de données injoignable">
            <p>
              La base de données ne répond pas en ce moment. Les pages peuvent afficher leur dernière version
              enregistrée ; aucune donnée fraîche ne peut être garantie tant que la connexion n&apos;est pas rétablie.
            </p>
          </Encadre>
        )}

        {etat.mode === "connecte" && (
          <dl className="mt-8 divide-y divide-border rounded-2xl border border-border bg-surface shadow-sm">
            {/* Âges calculés à l'instant de la lecture en base (page régénérée
                chaque minute), d'où la mention en bas de page. */}
            {lignes(etat, new Date(etat.luA).getTime()).map((ligne) => (
              <div key={ligne.titre} className="px-5 py-4">
                <dt className="text-xs font-bold uppercase tracking-widest text-muted">{ligne.titre}</dt>
                <dd className="mt-1">
                  <p className={`font-semibold ${ligne.alerte ? "text-danger" : "text-fg"}`}>{ligne.valeur}</p>
                  <p className="mt-1 text-sm leading-6 text-muted">{ligne.detail}</p>
                </dd>
              </div>
            ))}
          </dl>
        )}

        <p className="mt-6 text-xs leading-5 text-muted">
          Page régénérée au plus toutes les minutes ; heures exprimées à l&apos;heure de Paris
          {etat.mode === "connecte" ? `, courses du jour au ${new Date(`${etat.dateDuJour}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}` : ""}.
          Le détail de la méthode est sur{" "}
          <Link className="underline underline-offset-2 hover:text-accent-text" href="/methode">
            Notre méthode
          </Link>
          , les résultats mesurés sur le{" "}
          <Link className="underline underline-offset-2 hover:text-accent-text" href="/track-record">
            suivi de performance
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
