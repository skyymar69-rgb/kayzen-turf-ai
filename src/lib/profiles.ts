/**
 * PROFILS DES PARTANTS ET VERDICT DE COURSE — une seule source de vérité.
 *
 * Le bandeau de tuiles, les badges du tableau, la fiche cheval, le pronostic
 * gelé et le backtest lisent tous cette classification. Une maquette affichait
 * « Bases : 7 - 10 » dans le bandeau et un badge BASE sur le 14 et le 8 : deux
 * sources de vérité. Ici, il n'y en a qu'une.
 *
 * Chaque cheval reçoit UN profil, évalué dans l'ordre de `PROFILE_ORDER`. Les
 * seuils sont des points de départ explicites, publiés sur la page /methode, et
 * leur rendement réel est mesuré par le backtest (/track-record) : aucun profil
 * n'est présenté comme gagnant sans son ROI historique à côté.
 *
 * Deux probabilités sont confrontées :
 *   - le MARCHÉ : cote PMU, marge du PMU retirée (`marketProbability`) ;
 *   - le modèle FONDAMENTAL : forme, gains, entourage… sans jamais voir la cote
 *     (`fundamentalProbability`). C'est lui que le site appelle « l'IA ».
 */

export type Profile = "base" | "cache" | "value" | "favori" | "outsider" | "tocard" | "eviter" | "second";

export const PROFILE_ORDER: Profile[] = ["eviter", "base", "cache", "value", "favori", "outsider", "tocard", "second"];

export const PROFILE_LABELS: Record<Profile, string> = {
  base: "Base",
  cache: "Caché",
  value: "Value",
  favori: "Favori",
  outsider: "Outsider",
  tocard: "Tocard",
  eviter: "À éviter",
  second: "Second plan",
};

/**
 * Seuils v2, fixés le 02/10/2026 sur le backtest juin-septembre 2026 (2 069
 * courses, rapports officiels PMU) et vérifiés sur ses deux moitiés séparément.
 * Changer un seuil change `PROFILES_VERSION`.
 *
 * Mesures (ROI net en simple gagnant ; A/E = victoires observées ÷ victoires
 * annoncées par la cote connue 15 min avant le départ) :
 *
 *   Base v2      ROI −7 %   A/E 1,28    (v1 : −13 %, A/E 1,12)
 *   Caché v2     ROI −16 %  A/E 1,30    (v1 : −30 %, 26 % des partants classés)
 *   Value v2     ROI −15 %  A/E 1,43    (v1 : −19 %)
 *   À éviter     ROI −16 %  A/E 0,74 — ils gagnent 26 % moins que ne le dit la cote
 *   Tous         ROI −26 %  (le prix du prélèvement et du biais des grosses cotes)
 *
 * Aucun profil n'est rentable : les signaux de l'IA décrivent des chevaux qui
 * battent la cote connue avant le départ, mais la cote finale les rattrape.
 */
export const PROFILE_THRESHOLDS = {
  /** À éviter : l'IA lui donne moins de 3 % ET au moins 30 % de moins que le marché. */
  avoidMaxFundamental: 3,
  avoidMaxRatio: 0.7,
  /** Base : 1er ou 2e de la sélection, Top 3 d'au moins 45 %, et l'IA au moins aussi confiante que le marché. */
  baseMaxRank: 2,
  baseMinTop3: 45,
  baseMinRatio: 1,
  /** Caché : cote d'au moins 10/1, dans les 3 premiers de l'IA, qui lui donne au moins 1,5 fois la probabilité du marché. */
  hiddenMinOdds: 10,
  hiddenMaxAiRank: 3,
  hiddenMinRatio: 1.5,
  /** Value : sous 10/1, l'IA lui donne au moins 1,5 fois la probabilité du marché. */
  valueMinRatio: 1.5,
  /** Favori : cote sous 6/1 (convention presse), sans être Base. */
  favoriteMaxOdds: 6,
  /** Outsider : entre 8/1 et 25/1, et l'IA au moins aussi confiante que le marché. */
  outsiderMinOdds: 8,
  outsiderMaxOdds: 25,
  outsiderMinRatio: 1,
  /** Tocard : au-delà de 25/1. */
  tocardMinOdds: 25,
} as const;

export const PROFILES_VERSION = "profils-v2";

/**
 * Date à laquelle les seuils ci-dessus ont été figés. Toute course antérieure a
 * servi à les choisir : le backtest la classe en « période d'ajustement »
 * (dans l'échantillon) et ne présente comme mesure honnête que les courses à
 * partir de cette date (« hors échantillon »), plus le suivi en direct.
 * Changer un seuil impose d'avancer cette date en même temps que `PROFILES_VERSION`.
 */
export const PROFILES_FROZEN_AT = "2026-10-02";

export const PROFILE_RULES: Array<{ profile: Profile; rule: string }> = [
  { profile: "eviter", rule: `L'IA lui donne moins de ${PROFILE_THRESHOLDS.avoidMaxFundamental} % de chances, et au moins ${Math.round((1 - PROFILE_THRESHOLDS.avoidMaxRatio) * 100)} % de moins que le marché.` },
  { profile: "base", rule: `1er ou 2e de notre sélection, au moins ${PROFILE_THRESHOLDS.baseMinTop3} % de chances de finir dans les 3 premiers, et l'IA au moins aussi confiante que le marché.` },
  { profile: "cache", rule: `Cote d'au moins ${PROFILE_THRESHOLDS.hiddenMinOdds}/1, classé dans les ${PROFILE_THRESHOLDS.hiddenMaxAiRank} premiers par l'IA, qui lui donne au moins ${String(PROFILE_THRESHOLDS.hiddenMinRatio).replace(".", ",")} fois la probabilité du marché.` },
  { profile: "value", rule: `Cote sous ${PROFILE_THRESHOLDS.hiddenMinOdds}/1, et l'IA lui donne au moins ${String(PROFILE_THRESHOLDS.valueMinRatio).replace(".", ",")} fois la probabilité du marché.` },
  { profile: "favori", rule: `Cote sous ${PROFILE_THRESHOLDS.favoriteMaxOdds}/1, sans remplir les conditions d'une base.` },
  { profile: "outsider", rule: `Cote entre ${PROFILE_THRESHOLDS.outsiderMinOdds}/1 et ${PROFILE_THRESHOLDS.outsiderMaxOdds}/1, et l'IA au moins aussi confiante que le marché.` },
  { profile: "tocard", rule: `Cote au-delà de ${PROFILE_THRESHOLDS.tocardMinOdds}/1.` },
  { profile: "second", rule: "Tous les autres partants." },
];

export type ProfileInput = {
  number: number;
  odds: number;
  /** Probabilité de victoire affichée (marché + correction du modèle), en %. */
  winProbability: number;
  top3Probability: number;
  /** Probabilité du marché, marge retirée, en %. */
  marketProbability?: number | null;
  /** Probabilité du modèle fondamental, sans cote, en %. */
  fundamentalProbability?: number | null;
};

export type ProfiledHorse = {
  number: number;
  profile: Profile;
  /** Rang dans le classement affiché (probabilité décroissante), à partir de 1. */
  rank: number;
  /** IA ÷ marché. > 1 : l'IA le juge sous-coté. `null` sans cote ou sans modèle. */
  ratio: number | null;
};

function ratioOf(h: ProfileInput): number | null {
  const market = Number(h.marketProbability);
  const fundamental = Number(h.fundamentalProbability);
  if (!(Number.isFinite(h.odds) && h.odds > 1) || !(market > 0) || !Number.isFinite(fundamental)) return null;
  return fundamental / market;
}

function profileOf(h: ProfileInput, rank: number, aiRank: number): Profile {
  const t = PROFILE_THRESHOLDS;
  const ratio = ratioOf(h);
  const odds = Number.isFinite(h.odds) && h.odds > 1 ? h.odds : null;
  const fundamental = Number(h.fundamentalProbability);

  if (ratio !== null && fundamental < t.avoidMaxFundamental && ratio < t.avoidMaxRatio) return "eviter";
  if (rank <= t.baseMaxRank && h.top3Probability > t.baseMinTop3 && (ratio === null || ratio >= t.baseMinRatio)) return "base";
  if (odds === null || ratio === null) return odds !== null && odds < t.favoriteMaxOdds ? "favori" : "second";
  if (odds >= t.hiddenMinOdds && aiRank <= t.hiddenMaxAiRank && ratio >= t.hiddenMinRatio) return "cache";
  if (odds < t.hiddenMinOdds && ratio >= t.valueMinRatio) return "value";
  if (odds < t.favoriteMaxOdds) return "favori";
  if (odds >= t.outsiderMinOdds && odds <= t.outsiderMaxOdds && ratio >= t.outsiderMinRatio) return "outsider";
  if (odds > t.tocardMinOdds) return "tocard";
  return "second";
}

/** Classe tout le peloton. L'ordre de sortie est celui du classement affiché. */
export function classifyField(field: ProfileInput[]): ProfiledHorse[] {
  const ranked = [...field].sort(
    (a, b) => b.winProbability - a.winProbability || (a.odds || 999) - (b.odds || 999) || a.number - b.number,
  );
  const byAi = [...field]
    .filter((h) => Number.isFinite(Number(h.fundamentalProbability)))
    .sort((a, b) => Number(b.fundamentalProbability) - Number(a.fundamentalProbability))
    .map((h) => h.number);
  const aiRank = (n: number) => (byAi.includes(n) ? byAi.indexOf(n) + 1 : Infinity);
  return ranked.map((h, i) => ({ number: h.number, profile: profileOf(h, i + 1, aiRank(h.number)), rank: i + 1, ratio: ratioOf(h) }));
}

export type RaceReading = "lisible" | "ouverte" | "piege";

export const READING_LABELS: Record<RaceReading, string> = {
  lisible: "Course lisible",
  ouverte: "Course ouverte",
  piege: "Course piège",
};

/**
 * La lecture dépend de la concentration des probabilités, pas d'un avis de
 * l'IA : sur le backtest juin-septembre 2026, notre n° 1 gagne 45 % des courses
 * « lisibles », 27 % des « ouvertes » et 20 % des « pièges ». Une première
 * version classait « piège » toute course dont l'IA contestait le favori ; ces
 * favoris gagnaient pourtant presque aussi souvent que leur cote l'annonçait.
 */
export const READING_MIN_TOP = { lisible: 35, ouverte: 20 } as const;

export const READING_RULES: Record<RaceReading, string> = {
  lisible: `Le premier de la sélection a au moins ${READING_MIN_TOP.lisible} % de chances de gagner. Sur notre historique, il gagne 45 % de ces courses.`,
  ouverte: `Le premier de la sélection a entre ${READING_MIN_TOP.ouverte} et ${READING_MIN_TOP.lisible} % de chances. Il gagne 27 % de ces courses.`,
  piege: `Aucun cheval n'atteint ${READING_MIN_TOP.ouverte} % de chances : les probabilités sont dispersées. Notre n° 1 ne gagne que 20 % de ces courses.`,
};

export type RaceVerdict = {
  reading: RaceReading;
  /** Phrase courte, construite uniquement à partir des profils ci-dessus. */
  sentence: string;
  bases: number[];
  hidden: number[];
  values: number[];
};

export function raceVerdict(field: ProfileInput[], profiled = classifyField(field)): RaceVerdict {
  const byNumber = new Map(field.map((h) => [h.number, h]));
  const top = profiled[0] ? byNumber.get(profiled[0].number) : undefined;
  const topProbability = top?.winProbability ?? 0;
  const reading: RaceReading =
    topProbability >= READING_MIN_TOP.lisible ? "lisible" : topProbability >= READING_MIN_TOP.ouverte ? "ouverte" : "piege";

  const bases = profiled.filter((p) => p.profile === "base").map((p) => p.number);
  const hidden = profiled.filter((p) => p.profile === "cache").map((p) => p.number);
  const values = profiled.filter((p) => p.profile === "value").map((p) => p.number);

  // La lecture (« Course lisible ») est déjà affichée en pastille à côté de la
  // phrase : la répéter en tête donnait « COURSE LISIBLE / Course lisible · … ».
  const parts: string[] = [];
  if (bases.length === 1) parts.push(`base : n° ${bases[0]}`);
  else if (bases.length > 1) parts.push(`bases : n° ${bases.join(" et ")}`);
  else parts.push("pas de base solide");
  if (hidden.length > 0) {
    const h = byNumber.get(hidden[0])!;
    parts.push(hidden.length === 1 ? `un caché à ${formatOddsShort(h.odds)} (n° ${h.number})` : `${hidden.length} cachés (n° ${hidden.join(", ")})`);
  }

  const sentence = parts.join(" · ");
  return { reading, sentence: sentence.charAt(0).toUpperCase() + sentence.slice(1), bases, hidden, values };
}

function formatOddsShort(odds: number) {
  return `${Math.round(odds)}/1`;
}
