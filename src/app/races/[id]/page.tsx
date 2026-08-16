import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { CourseDetail } from "@/components/course-detail";
import { getRaceById } from "@/lib/race-repository";
import { SITE_URL } from "@/lib/site";

type RacePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = "force-dynamic";

/**
 * `generateMetadata` et le rendu de page demandent la même course. Sans `cache`,
 * chaque visite paie deux fois la requête base. React déduplique l'appel sur la
 * durée d'un rendu.
 */
const loadRace = cache((id: string) => getRaceById(id, { fallback: false }));

const dateLongue = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

function formatDate(raceDate: string) {
  const [year, month, day] = raceDate.split("-").map(Number);
  if (!year || !month || !day) return raceDate;
  return dateLongue.format(new Date(Date.UTC(year, month - 1, day, 12)));
}

/** Décalage réel de Paris ce jour-là : +01:00 l'hiver, +02:00 l'été. */
function decalageParis(raceDate: string) {
  const [year, month, day] = raceDate.split("-").map(Number);
  if (!year || !month || !day) return "+01:00";

  const nom = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", timeZoneName: "longOffset" })
    .formatToParts(new Date(Date.UTC(year, month - 1, day, 12)))
    .find((part) => part.type === "timeZoneName")?.value;

  return nom?.replace("GMT", "") || "+01:00";
}

/**
 * Les 100+ pages de courses partageaient le titre et la description du layout :
 * Google les voyait comme du contenu dupliqué et n'en indexait qu'une poignée.
 * Chaque course porte désormais ses propres balises et son canonique.
 */
export async function generateMetadata({ params }: RacePageProps): Promise<Metadata> {
  const { id } = await params;
  const race = await loadRace(decodeURIComponent(id));

  if (!race) {
    return {
      title: "Course introuvable",
      robots: { index: false, follow: true },
    };
  }

  const chemin = `/races/${encodeURIComponent(race.id)}`;
  const titre = `${race.programCode} ${race.name} — ${race.racecourse}`;
  const favori = race.horses[0];
  const description =
    `Pronostic IA de la ${race.programCode} ${race.name} à ${race.racecourse}, ` +
    `le ${formatDate(race.raceDate)} à ${race.startTime} — ${race.discipline}, ${race.distance}, ` +
    `${race.horses.length} partants.` +
    (favori ? ` Favori du modèle : ${favori.number} ${favori.horse}.` : "") +
    " Probabilités, top 3 et value bets.";

  return {
    title: titre,
    description,
    alternates: { canonical: chemin },
    openGraph: {
      type: "article",
      url: chemin,
      title: `${titre} — Kayzen Turf AI`,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: `${titre} — Kayzen Turf AI`,
      description,
    },
  };
}

export default async function RacePage({ params }: RacePageProps) {
  const { id } = await params;
  const race = await loadRace(decodeURIComponent(id));

  if (!race) notFound();

  /* Données structurées : une course est un SportsEvent daté et localisé. */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    "@id": `${SITE_URL}/races/${encodeURIComponent(race.id)}`,
    name: `${race.programCode} ${race.name}`,
    startDate: `${race.raceDate}T${race.startTime.replace("h", ":")}:00${decalageParis(race.raceDate)}`,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    sport: `Course hippique — ${race.discipline}`,
    location: {
      "@type": "Place",
      name: race.racecourse,
      address: { "@type": "PostalAddress", addressCountry: race.sourceCountry },
    },
    competitor: race.horses.slice(0, 6).map((horse) => ({
      "@type": "SportsTeam",
      name: horse.horse,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CourseDetail race={race} />
    </>
  );
}
