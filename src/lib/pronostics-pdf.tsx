import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { buildBetRecommendations, probableArrival, raceToContext } from "@/lib/bet-recommendations";
import type { HorsePrediction, RaceAnalysis } from "@/lib/types";

/* ─── Palette PMU ────────────────────────────────────────────────── */
const C = {
  dark:        "#0c2318",
  green:       "#004a38",
  cta:         "#1eb854",
  greenLight:  "#e8f5ec",
  greenPale:   "#f2faf5",
  fg:          "#111827",
  muted:       "#4b5563",
  mutedLight:  "#9ca3af",
  border:      "#e5e7eb",
  white:       "#ffffff",
  danger:      "#dc2626",
  warn:        "#b45309",
  warnBg:      "#fffbeb",
  valueBg:     "#ecfdf5",
};

/* ─── StyleSheet ─────────────────────────────────────────────────── */
const s = StyleSheet.create({
  page:    { paddingTop: 52, paddingBottom: 44, paddingHorizontal: 30, backgroundColor: C.white, fontFamily: "Helvetica", fontSize: 9, color: C.fg },

  /* fixed page header */
  pageHeader: { position: "absolute", top: 0, left: 0, right: 0, height: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 30, backgroundColor: C.dark },
  pageHeaderLeft:  { flexDirection: "row", alignItems: "center", gap: 8 },
  pageHeaderBadge: { width: 22, height: 22, borderRadius: 5, backgroundColor: C.cta, alignItems: "center", justifyContent: "center" },
  pageHeaderBadgeText: { fontFamily: "Helvetica-Bold", fontSize: 8, color: C.dark },
  pageHeaderTitle: { fontFamily: "Helvetica-Bold", fontSize: 10, color: C.white },
  pageHeaderSub:   { fontSize: 7, color: "#9ca3af", marginLeft: 2 },
  pageHeaderRight: { fontSize: 7, color: "#9ca3af" },

  /* fixed footer */
  pageFooter: { position: "absolute", bottom: 0, left: 30, right: 30, height: 30, borderTopWidth: 0.5, borderTopColor: "#374151", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pageFooterText: { fontSize: 6.5, color: C.mutedLight },

  /* cover block */
  cover: { marginBottom: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  coverTitle: { fontFamily: "Helvetica-Bold", fontSize: 22, color: C.dark, marginBottom: 4 },
  coverDate:  { fontSize: 10, color: C.muted, marginBottom: 8 },
  coverStats: { flexDirection: "row", gap: 10 },
  coverStat:  { backgroundColor: C.greenPale, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10, alignItems: "center", minWidth: 80 },
  coverStatValue: { fontFamily: "Helvetica-Bold", fontSize: 16, color: C.green },
  coverStatLabel: { fontSize: 7, color: C.muted, marginTop: 2 },

  /* race block */
  race:       { marginBottom: 14, borderRadius: 6, overflow: "hidden", borderWidth: 0.5, borderColor: C.border },
  raceHeader: { backgroundColor: C.dark, paddingVertical: 7, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  raceCode:   { fontFamily: "Helvetica-Bold", fontSize: 9, color: C.cta, marginRight: 6 },
  raceName:   { fontFamily: "Helvetica-Bold", fontSize: 10, color: C.white, flex: 1 },
  raceMeta:   { fontSize: 7.5, color: "#d1d5db", marginTop: 2 },
  raceTier:   { borderRadius: 4, paddingVertical: 2, paddingHorizontal: 6, fontSize: 7, fontFamily: "Helvetica-Bold" },

  /* decision zone */
  decision:      { flexDirection: "row", backgroundColor: C.greenPale, borderBottomWidth: 0.5, borderBottomColor: C.border },
  decisionCell:  { flex: 1, paddingVertical: 8, paddingHorizontal: 10, alignItems: "center" },
  decisionDivider: { width: 0.5, backgroundColor: C.border },
  decisionLabel: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 },
  decisionValue: { fontFamily: "Helvetica-Bold", fontSize: 16, color: C.green },
  decisionSub:   { fontSize: 7.5, color: C.muted, marginTop: 3 },

  /* horse table */
  tableHeader: { flexDirection: "row", backgroundColor: C.dark, paddingVertical: 5, paddingHorizontal: 6 },
  tableRow:    { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 0.3, borderBottomColor: C.border },
  tableRowAlt: { backgroundColor: C.greenPale },
  tableRowTop: { backgroundColor: "#e0f2e9" },
  thNum:    { width: 24, fontFamily: "Helvetica-Bold", fontSize: 7, color: C.white },
  thHorse:  { flex: 1,  fontFamily: "Helvetica-Bold", fontSize: 7, color: C.white },
  thDriver: { width: 80, fontFamily: "Helvetica-Bold", fontSize: 7, color: C.white },
  thOdds:   { width: 32, fontFamily: "Helvetica-Bold", fontSize: 7, color: C.white, textAlign: "right" },
  thKz:     { width: 28, fontFamily: "Helvetica-Bold", fontSize: 7, color: C.white, textAlign: "right" },
  thTop3:   { width: 36, fontFamily: "Helvetica-Bold", fontSize: 7, color: C.white, textAlign: "right" },
  thWin:    { width: 36, fontFamily: "Helvetica-Bold", fontSize: 7, color: C.white, textAlign: "right" },
  tdNum:    { width: 24, fontFamily: "Helvetica-Bold", fontSize: 8, color: C.green },
  tdHorse:  { flex: 1,  fontSize: 8, fontFamily: "Helvetica-Bold", color: C.fg },
  tdDriver: { width: 80, fontSize: 7.5, color: C.muted },
  tdOdds:   { width: 32, fontSize: 8, color: C.fg, textAlign: "right" },
  tdKz:     { width: 28, fontFamily: "Helvetica-Bold", fontSize: 8, color: C.green, textAlign: "right" },
  tdTop3:   { width: 36, fontSize: 7.5, color: C.muted, textAlign: "right" },
  tdWin:    { width: 36, fontSize: 7.5, color: C.muted, textAlign: "right" },

  /* signals */
  signals:     { flexDirection: "row", padding: 8, gap: 6 },
  signal:      { flex: 1, borderRadius: 4, padding: 6 },
  signalBase:  { backgroundColor: "#e0f2e9", borderWidth: 0.5, borderColor: C.cta },
  signalOut:   { backgroundColor: "#fef3c7", borderWidth: 0.5, borderColor: "#d97706" },
  signalLong:  { backgroundColor: "#f0f9ff", borderWidth: 0.5, borderColor: "#0ea5e9" },
  signalLabel: { fontSize: 6.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 },
  signalNum:   { fontFamily: "Helvetica-Bold", fontSize: 12, marginBottom: 1 },
  signalName:  { fontSize: 7.5, color: C.muted },
  signalDetail:{ fontSize: 6.5, color: C.mutedLight, marginTop: 2 },

  /* music */
  musicRow:  { paddingHorizontal: 10, paddingBottom: 6, flexDirection: "row", flexWrap: "wrap", gap: 4 },
  musicChip: { backgroundColor: C.greenPale, borderRadius: 3, paddingVertical: 2, paddingHorizontal: 5, fontSize: 6.5, color: C.muted },
});

/* ─── Helpers ────────────────────────────────────────────────────── */
function fmt(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v as number)) return "—";
  return Math.round(v as number).toString();
}
function fmtProb(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v as number)) return "—";
  return `${Math.round(v as number)}%`;
}
function fmtOdds(v: number) {
  return v > 0 ? String(v) : "—";
}
function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
function formatDate(d: string) {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date(`${d}T12:00:00`));
}
function formatMeters(distance: string) {
  return String(distance).replace(/\D/g, "") || distance;
}
function tierColor(tier: RaceAnalysis["bettingTier"]): string {
  if (tier === "Focus") return C.cta;
  if (tier === "Value") return "#d97706";
  return C.mutedLight;
}
function tierLabel(tier: RaceAnalysis["bettingTier"]): string {
  if (tier === "Focus") return "Focus";
  if (tier === "Value") return "Value";
  return "Prudence";
}

/* ─── Sub-components ─────────────────────────────────────────────── */

function RaceBlock({ race }: { race: RaceAnalysis }) {
  const ctx     = raceToContext(race);
  const arrival = probableArrival(race.horses, ctx);
  const recs    = buildBetRecommendations(race.horses, race.betTypes, ctx);
  const topRec  = recs[0];
  const base    = arrival[0];
  const outsider = arrival.find((h) => h.valueIndex >= 10 && h.odds >= 6);
  const tocard   = arrival.find((h) => h.odds >= 15 && h.top3Probability >= 18);

  const isTrot = race.discipline === "Trot";
  const driverLabel = isTrot ? "Driver" : "Jockey";

  const ordreStr  = arrival.slice(0, 5).map((h) => h.number).join(" – ");
  const ticketStr = topRec ? topRec.ticket : "—";
  const confStr   = topRec ? `${topRec.confidence}/99` : "—";

  return (
    <View style={s.race} wrap={false}>
      {/* Header band */}
      <View style={s.raceHeader}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
            <Text style={s.raceCode}>{race.programCode}</Text>
            <Text style={s.raceName}>{titleCase(race.name)}</Text>
            <View style={[s.raceTier, { backgroundColor: tierColor(race.bettingTier) + "30", borderWidth: 0.5, borderColor: tierColor(race.bettingTier) }]}>
              <Text style={{ color: tierColor(race.bettingTier), fontFamily: "Helvetica-Bold", fontSize: 7 }}>{tierLabel(race.bettingTier)}</Text>
            </View>
          </View>
          <Text style={s.raceMeta}>
            {race.startTime}  ·  {race.discipline}  ·  {formatMeters(race.distance)} m  ·  {race.racecourse}
            {race.going ? `  ·  ${race.going}` : ""}
            {race.weather ? `  ·  ${race.weather}` : ""}
          </Text>
        </View>
      </View>

      {/* Decision zone */}
      <View style={s.decision}>
        <View style={s.decisionCell}>
          <Text style={s.decisionLabel}>Ordre probable</Text>
          <Text style={s.decisionValue}>{ordreStr}</Text>
          <Text style={s.decisionSub}>{arrival.length} partants</Text>
        </View>
        <View style={s.decisionDivider} />
        <View style={s.decisionCell}>
          <Text style={s.decisionLabel}>Ticket recommandé</Text>
          <Text style={s.decisionValue}>{ticketStr}</Text>
          <Text style={s.decisionSub}>{topRec ? topRec.label : "—"}</Text>
        </View>
        <View style={s.decisionDivider} />
        <View style={s.decisionCell}>
          <Text style={s.decisionLabel}>Confiance IA</Text>
          <Text style={[s.decisionValue, { fontSize: 18 }]}>{confStr}</Text>
          <Text style={s.decisionSub}>{topRec ? topRec.strategy : "—"}</Text>
        </View>
      </View>

      {/* Horse table */}
      <View style={s.tableHeader}>
        <Text style={s.thNum}>N°</Text>
        <Text style={s.thHorse}>Cheval</Text>
        <Text style={s.thDriver}>{driverLabel}</Text>
        <Text style={s.thOdds}>Cote</Text>
        <Text style={s.thKz}>KZ</Text>
        <Text style={s.thTop3}>Top 3</Text>
        <Text style={s.thWin}>Gagnant</Text>
      </View>
      {arrival.map((horse, idx) => (
        <HorseRow key={horse.id} horse={horse} idx={idx} />
      ))}

      {/* Signals */}
      {(base || outsider || tocard) && (
        <View style={s.signals}>
          {base && (
            <View style={[s.signal, s.signalBase]}>
              <Text style={[s.signalLabel, { color: C.green }]}>Base</Text>
              <Text style={[s.signalNum, { color: C.green }]}>#{base.number}</Text>
              <Text style={s.signalName}>{titleCase(base.horse)}</Text>
              <Text style={s.signalDetail}>KZ {fmt(base.kzScore)}  ·  Cote {fmtOdds(base.odds)}  ·  Top3 {fmtProb(base.top3Probability)}</Text>
            </View>
          )}
          {outsider && outsider.id !== base?.id ? (
            <View style={[s.signal, s.signalOut]}>
              <Text style={[s.signalLabel, { color: "#b45309" }]}>Outsider</Text>
              <Text style={[s.signalNum, { color: "#b45309" }]}>#{outsider.number}</Text>
              <Text style={s.signalName}>{titleCase(outsider.horse)}</Text>
              <Text style={s.signalDetail}>Edge +{Math.round(outsider.valueIndex)}%  ·  Cote {fmtOdds(outsider.odds)}</Text>
            </View>
          ) : (
            <View style={[s.signal, s.signalOut]}>
              <Text style={[s.signalLabel, { color: "#b45309" }]}>Outsider</Text>
              <Text style={[s.signalNum, { color: "#b45309" }]}>—</Text>
              <Text style={s.signalDetail}>Aucun signal value détecté</Text>
            </View>
          )}
          {tocard && tocard.id !== base?.id && tocard.id !== outsider?.id ? (
            <View style={[s.signal, s.signalLong]}>
              <Text style={[s.signalLabel, { color: "#0284c7" }]}>Tocard surveillé</Text>
              <Text style={[s.signalNum, { color: "#0284c7" }]}>#{tocard.number}</Text>
              <Text style={s.signalName}>{titleCase(tocard.horse)}</Text>
              <Text style={s.signalDetail}>Cote {fmtOdds(tocard.odds)}  ·  Top3 {fmtProb(tocard.top3Probability)}</Text>
            </View>
          ) : (
            <View style={[s.signal, s.signalLong]}>
              <Text style={[s.signalLabel, { color: "#0284c7" }]}>Tocard surveillé</Text>
              <Text style={[s.signalNum, { color: "#0284c7" }]}>—</Text>
              <Text style={s.signalDetail}>Aucun outsider surprise</Text>
            </View>
          )}
        </View>
      )}

      {/* Musics / dernières performances */}
      {arrival.some((h) => h.music) && (
        <View style={s.musicRow}>
          {arrival.slice(0, 6).filter((h) => h.music).map((h) => (
            <View key={h.id} style={s.musicChip}>
              <Text>#{h.number} {h.music?.slice(0, 20) ?? ""}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function HorseRow({ horse, idx }: { horse: HorsePrediction; idx: number }) {
  const isTop = idx === 0;
  const rowStyle = isTop ? s.tableRowTop : idx % 2 === 1 ? s.tableRowAlt : s.tableRow;
  return (
    <View style={[s.tableRow, rowStyle]}>
      <Text style={[s.tdNum, isTop ? { color: C.dark } : {}]}>#{horse.number}</Text>
      <Text style={[s.tdHorse, isTop ? { color: C.dark } : {}]}>{horse.horse.length > 20 ? horse.horse.slice(0, 20) + "." : horse.horse}</Text>
      <Text style={s.tdDriver}>{horse.jockey.length > 14 ? horse.jockey.slice(0, 14) + "." : horse.jockey}</Text>
      <Text style={s.tdOdds}>{fmtOdds(horse.odds)}</Text>
      <Text style={[s.tdKz, isTop ? { color: C.dark } : {}]}>{fmt(horse.kzScore)}</Text>
      <Text style={s.tdTop3}>{fmtProb(horse.top3Probability)}</Text>
      <Text style={s.tdWin}>{fmtProb(horse.winProbability)}</Text>
    </View>
  );
}

/* ─── Main document ──────────────────────────────────────────────── */

export function PronosticsPDF({ races, date }: { races: RaceAnalysis[]; date: string }) {
  const sorted = [...races].sort((a, b) =>
    a.startTime.localeCompare(b.startTime) || a.reunionNumber - b.reunionNumber || a.courseNumber - b.courseNumber,
  );

  const totalHorses   = races.reduce((t, r) => t + r.horses.length, 0);
  const reunionCount  = new Set(races.map((r) => r.reunionNumber)).size;
  const todayLabel    = formatDate(date);

  return (
    <Document
      title={`Kayzen — Pronostics PMU ${date}`}
      author="Kayzen Turf AI"
      creator="Kayzen Turf AI"
      producer="@react-pdf/renderer"
    >
      <Page size="A4" style={s.page}>

        {/* Fixed page header — every page */}
        <View style={s.pageHeader} fixed>
          <View style={s.pageHeaderLeft}>
            <View style={s.pageHeaderBadge}>
              <Text style={s.pageHeaderBadgeText}>KZ</Text>
            </View>
            <Text style={s.pageHeaderTitle}>Kayzen</Text>
            <Text style={s.pageHeaderSub}>PRONOSTICS PMU — {date}</Text>
          </View>
          <Text style={s.pageHeaderRight} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>

        {/* Cover block */}
        <View style={s.cover}>
          <Text style={s.coverTitle}>Pronostics du jour</Text>
          <Text style={s.coverDate}>{todayLabel}</Text>
          <View style={s.coverStats}>
            <View style={s.coverStat}>
              <Text style={s.coverStatValue}>{reunionCount}</Text>
              <Text style={s.coverStatLabel}>Réunion{reunionCount > 1 ? "s" : ""}</Text>
            </View>
            <View style={s.coverStat}>
              <Text style={s.coverStatValue}>{races.length}</Text>
              <Text style={s.coverStatLabel}>Course{races.length > 1 ? "s" : ""}</Text>
            </View>
            <View style={s.coverStat}>
              <Text style={s.coverStatValue}>{totalHorses}</Text>
              <Text style={s.coverStatLabel}>Partants</Text>
            </View>
            <View style={[s.coverStat, { backgroundColor: C.warnBg }]}>
              <Text style={[s.coverStatValue, { fontSize: 9, color: C.warn, marginTop: 3 }]}>Aide à la décision uniquement</Text>
              <Text style={[s.coverStatLabel, { color: C.warn }]}>Aucun gain garanti</Text>
            </View>
          </View>
        </View>

        {/* Race blocks */}
        {sorted.map((race) => (
          <RaceBlock key={race.id} race={race} />
        ))}

        {/* Fixed footer — every page */}
        <View style={s.pageFooter} fixed>
          <Text style={s.pageFooterText}>
            Kayzen Turf AI — Outil d'aide à la décision. Aucun pronostic ne garantit un gain. Les jeux d'argent comportent des risques.
          </Text>
          <Text style={s.pageFooterText}>{date}</Text>
        </View>

      </Page>
    </Document>
  );
}
