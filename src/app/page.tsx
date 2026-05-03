import { Dashboard } from "@/components/dashboard";
import { getRaces } from "@/lib/race-repository";

export default async function Home() {
  const races = await getRaces();

  return <Dashboard races={races} />;
}
