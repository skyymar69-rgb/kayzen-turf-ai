"use client";

import { FollowedHorsesPanel } from "@/components/followed-horses-panel";
import { useFavorites } from "@/hooks/use-favorites";
import type { RaceAnalysis } from "@/lib/types";
import { CustomizeBlocks } from "./customize-blocks";
import { DayIndicators, TopRaces } from "./day-indicators";
import { DaySummaryCard } from "./day-summary-card";
import { EmptyProgramme } from "./empty-state";
import { FeaturedRace } from "./featured-race";
import { FollowedToday } from "./followed-today";
import { PerformancePanel } from "./performance-panel";
import { ProfilesPanel } from "./profiles-panel";
import { ProgrammeHero } from "./programme-hero";
import { ProgrammeSection } from "./programme-section";
import { RacePreview } from "./race-preview";
import { RaceTimeline } from "./race-timeline";
import { SurprisesOfDay } from "./surprises-of-day";
import type { DashboardPerformance } from "./types";
import { useHomeBlocks } from "./use-home-blocks";
import { useHomeProgramme } from "./use-home-programme";
import { useParisNow } from "./use-paris-clock";
import { YesterdayCard } from "./yesterday-card";

export type { DashboardPerformance } from "./types";

type HomePageProps = { races: RaceAnalysis[]; performance?: DashboardPerformance | null };

/**
 * ACCUEIL — programme PMU du jour. Composition seule : l'état vit dans
 * `useHomeProgramme`, les calculs dans src/lib/home, l'affichage dans les
 * composants voisins. Les blocs secondaires peuvent être masqués par le
 * visiteur (« Personnaliser ») ; le programme, lui, reste toujours affiché.
 */
export function HomePage({ races, performance = null }: HomePageProps) {
  const nowMs = useParisNow();
  const { favs, toggle: toggleFav } = useFavorites();
  const blocks = useHomeBlocks();
  const programme = useHomeProgramme(races, nowMs);
  const { dayFilter, dayRaces, selectedMeeting, selectedRace, insights, star, signalsFor } = programme;
  const show = blocks.isVisible;

  if (!selectedMeeting || !selectedRace) {
    return <EmptyProgramme dayFilter={dayFilter} disciplineFilter={programme.disciplineFilter} onSelectDay={programme.selectDay} />;
  }

  return (
    <main className="min-h-screen bg-bg pb-20" id="contenu-principal">
      <div className="mx-auto max-w-[1480px] px-4 sm:px-6 lg:px-8">
        {show("followed") && <FollowedToday day={dayFilter} nowMs={nowMs} races={dayRaces} />}

        <ProgrammeHero favCount={favs.size} nowMs={nowMs} programme={programme} races={races} />

        <div className="mb-4">
          <CustomizeBlocks hidden={blocks.hidden} onShowAll={blocks.showAll} onToggle={blocks.toggle} />
        </div>

        {show("summary") && <DaySummaryCard day={dayFilter} races={dayRaces} />}
        {show("yesterday") && <YesterdayCard races={races} />}
        {show("timeline") && <RaceTimeline nowMs={nowMs} races={dayRaces} />}
        {show("featured") && star && <FeaturedRace race={star} />}
        {show("surprises") && <SurprisesOfDay races={dayRaces} />}
        {show("indicators") && (
          <>
            <DayIndicators insights={insights} raceCount={dayRaces.length} />
            <TopRaces insights={insights} signalsFor={signalsFor} />
          </>
        )}

        <ProgrammeSection favs={favs} nowMs={nowMs} onToggleFav={toggleFav} programme={programme} races={races} />

        <FollowedHorsesPanel races={races} />

        <RacePreview race={selectedRace} />

        {show("profiles") && <ProfilesPanel races={dayRaces} />}

        <PerformancePanel performance={performance} />
      </div>
    </main>
  );
}
