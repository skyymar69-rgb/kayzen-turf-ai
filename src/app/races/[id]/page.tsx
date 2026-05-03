import { notFound } from "next/navigation";
import { CourseDetail } from "@/components/course-detail";
import { getRaceById } from "@/lib/race-repository";

type RacePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function RacePage({ params }: RacePageProps) {
  const { id } = await params;
  const race = await getRaceById(decodeURIComponent(id), undefined, { fallback: false });

  if (!race) notFound();

  return <CourseDetail race={race} />;
}
