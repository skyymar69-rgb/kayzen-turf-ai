import { Dashboard } from "@/components/dashboard";
import { raceCards } from "@/lib/mock-data";

export default function Home() {
  return <Dashboard races={raceCards} />;
}
