import { HomePage, type DashboardPerformance } from "@/components/home/home-page";
import { getLatestTrackRecord, getRaces } from "@/lib/race-repository";

// `force-dynamic` refaisait la cascade de requêtes à chaque visite (TTFB mesuré
// à 2,2 s). Les cotes PMU ne bougent pas à la seconde : 60 s de fraîcheur
// suffisent largement et le rendu passe à ~0,1 s sur cache chaud.
export const revalidate = 60;

export default async function Home() {
  const [races, report] = await Promise.all([getRaces(), getLatestTrackRecord()]);
  const rank1 = report?.signals.find((s) => s.key === "rank1-sg");
  const performance: DashboardPerformance | null = report
    ? {
        generatedAt: report.generatedAt,
        racesEvaluated: Number(report.racesEvaluated ?? 0),
        top3HitsPerRace: Number((report.accuracy as { top3HitsPerRace?: number } | undefined)?.top3HitsPerRace ?? 0),
        rank1WinRate: rank1?.hitRate ?? null,
        rank1Roi: rank1?.roi ?? null,
        rank1Bets: rank1?.bets ?? 0,
      }
    : null;

  return <HomePage performance={performance} races={races} />;
}
