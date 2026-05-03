import { Dashboard } from "@/components/dashboard";
import { raceAnalysis } from "@/lib/mock-data";

export default function Home() {
  return <Dashboard race={raceAnalysis} />;
}
