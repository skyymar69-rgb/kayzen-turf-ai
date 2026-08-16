import { Dashboard } from "@/components/dashboard";
import { getRaces } from "@/lib/race-repository";

// `force-dynamic` refaisait la cascade de requêtes à chaque visite (TTFB mesuré
// à 2,2 s). Les cotes PMU ne bougent pas à la seconde : 60 s de fraîcheur
// suffisent largement et le rendu passe à ~0,1 s sur cache chaud.
export const revalidate = 60;

export default async function Home() {
  const races = await getRaces();

  return <Dashboard races={races} />;
}
