import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { buildBetRecommendations, probableArrival, raceToContext } from "@/lib/bet-recommendations";
import type { RaceAnalysis } from "@/lib/types";

/* ─── Palette ─────────────────────────────────────────────────────── */
const C = {
  dark:      "#0c2318",
  green:     "#004a38",
  cta:       "#1eb854",
  pale:      "#f2faf5",
  fg:        "#111827",
  muted:     "#6b7280",
  border:    "#e5e7eb",
  borderDk:  "#d1d5db",
  white:     "#ffffff",
  warn:      "#d97706",
  warnBg:    "#fffbeb",
  blue:      "#0284c7",
};

/* ─── Styles ──────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  page: {
    paddingTop: 38, paddingBottom: 28, paddingHorizontal: 24,
    backgroundColor: C.white, fontFamily: "Helvetica", fontSize: 8, color: C.fg,
  },

  /* fixed header */
  hdr: {
    position: "absolute", top: 0, left: 0, right: 0, height: 30,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 24, backgroundColor: C.dark,
  },
  hdrLeft:  { flexDirection: "row", alignItems: "center", gap: 7 },
  hdrBadge: { width: 18, height: 18, borderRadius: 4, backgroundColor: C.cta, alignItems: "center", justifyContent: "center" },
  hdrBadgeTxt: { fontFamily: "Helvetica-Bold", fontSize: 7, color: C.dark },
  hdrTitle: { fontFamily: "Helvetica-Bold", fontSize: 9, color: C.white },
  hdrSub:   { fontSize: 6.5, color: "#9ca3af" },
  hdrRight: { fontSize: 6.5, color: "#9ca3af" },

  /* fixed footer */
  ftr: {
    position: "absolute", bottom: 0, left: 24, right: 24, height: 22,
    borderTopWidth: 0.5, borderTopColor: "#374151",
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  ftrTxt: { fontSize: 6, color: "#9ca3af" },

  /* summary strip */
  strip: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginBottom: 10, paddingBottom: 8,
    borderBottomWidth: 0.5, borderBottomColor: C.borderDk,
  },
  stripTitle: { fontFamily: "Helvetica-Bold", fontSize: 14, color: C.dark, flex: 1 },
  stripDate:  { fontSize: 8, color: C.muted },
  statBox:    { backgroundColor: C.pale, borderRadius: 4, paddingVertical: 4, paddingHorizontal: 8, alignItems: "center" },
  statVal:    { fontFamily: "Helvetica-Bold", fontSize: 11, color: C.green },
  statLbl:    { fontSize: 6, color: C.muted, marginTop: 1 },
  warnBox:    { backgroundColor: C.warnBg, borderRadius: 4, paddingVertical: 4, paddingHorizontal: 8, alignItems: "center" },
  warnVal:    { fontSize: 6.5, color: C.warn, fontFamily: "Helvetica-Bold" },
  warnLbl:    { fontSize: 6, color: C.warn },

  /* table */
  tblHead: {
    flexDirection: "row", backgroundColor: C.dark,
    paddingVertical: 5, paddingHorizontal: 6, borderRadius: 3,
    marginBottom: 1,
  },
  meetingRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.green,
    paddingVertical: 4, paddingHorizontal: 6,
    marginTop: 4, marginBottom: 1,
  },
  meetingLabel: { fontFamily: "Helvetica-Bold", fontSize: 7.5, color: C.cta },
  meetingName:  { fontSize: 7, color: "#9ca3af", marginLeft: 6, flex: 1 },
  meetingDate:  { fontSize: 6.5, color: "#9ca3af" },

  row:    { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 0.3, borderBottomColor: C.border },
  rowAlt: { backgroundColor: C.pale },

  /* column widths */
  cCode:   { width: 34, fontFamily: "Helvetica-Bold" },
  cHour:   { width: 30 },
  cName:   { flex: 1 },
  cDist:   { width: 34 },
  cOrdre:  { width: 88 },
  cTicket: { width: 58 },
  cConf:   { width: 26 },
  cBase:   { width: 22 },
  cSignal: { width: 38 },

  /* th / td */
  th: { fontFamily: "Helvetica-Bold", fontSize: 6.5, color: C.white },
  tdMuted: { color: C.muted },
  tdBold:  { fontFamily: "Helvetica-Bold", color: C.fg },
  tdGreen: { fontFamily: "Helvetica-Bold", color: C.green },
  tdWarn:  { fontFamily: "Helvetica-Bold", color: C.warn },
  tdFocus: { fontFamily: "Helvetica-Bold", color: C.cta },
  tdBlue:  { fontFamily: "Helvetica-Bold", color: C.blue },
});

/* ─── Helpers ─────────────────────────────────────────────────────── */
function fmt(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v as number)) return "—";
  return Math.round(v as number).toString();
}
function formatDate(d: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  }).format(new Date(`${d}T12:00:00`));
}
function formatMeters(distance: string) {
  const m = String(distance).replace(/\D/g, "");
  return m ? `${m}m` : distance;
}
function signalStyle(tier: RaceAnalysis["bettingTier"]) {
  if (tier === "Focus") return s.tdFocus;
  if (tier === "Value") return s.tdWarn;
  return s.tdMuted;
}
function signalLabel(tier: RaceAnalysis["bettingTier"]) {
  if (tier === "Focus") return "Focus";
  if (tier === "Value") return "Value";
  return "Prudence";
}

/* ─── Race row ────────────────────────────────────────────────────── */
function RaceRow({ race, idx }: { race: RaceAnalysis; idx: number }) {
  const ctx      = raceToContext(race);
  const arrival  = probableArrival(race.horses, ctx);
  const recs     = buildBetRecommendations(race.horses, race.betTypes, ctx);
  const topRec   = recs[0];
  const base     = arrival[0];
  const outsider = arrival.find((h) => h.id !== base?.id && h.valueIndex >= 10 && h.odds >= 6);

  const ordreStr  = arrival.slice(0, 5).map((h) => h.number).join("-");
  const ticketStr = topRec ? topRec.ticket : "—";
  const confStr   = topRec ? `${topRec.confidence}` : "—";
  const baseStr   = base ? `#${base.number}` : "—";
  const outStr    = outsider ? `#${outsider.number}` : "—";
  const distStr   = formatMeters(race.distance);
  const isAlt     = idx % 2 === 1;

  const codeParts = race.programCode.match(/^(R\d+)(C\d+)$/);
  const codeDisp  = codeParts ? (
    <Text style={[s.cCode, s.th, { color: C.cta }]}>{codeParts[1]}<Text style={{ color: C.white }}>{codeParts[2]}</Text></Text>
  ) : (
    <Text style={[s.cCode, s.tdGreen]}>{race.programCode}</Text>
  );

  return (
    <View style={[s.row, isAlt ? s.rowAlt : {}]}>
      <Text style={[s.cCode, s.tdGreen]}>{race.programCode}</Text>
      <Text style={[s.cHour, s.tdMuted]}>{race.startTime}</Text>
      <Text style={[s.cName]} numberOfLines={1}>
        {race.name.length > 26 ? race.name.slice(0, 25) + "…" : race.name}
      </Text>
      <Text style={[s.cDist, s.tdMuted]}>{distStr}</Text>
      <Text style={[s.cOrdre, s.tdBold]}>{ordreStr}</Text>
      <Text style={[s.cTicket, { fontFamily: "Helvetica-Bold", color: C.dark }]}>{ticketStr}</Text>
      <Text style={[s.cConf, s.tdGreen]}>{confStr}</Text>
      <Text style={[s.cBase, s.tdGreen]}>{baseStr}</Text>
      <Text style={[s.cSignal, signalStyle(race.bettingTier)]}>{signalLabel(race.bettingTier)}</Text>
    </View>
  );
}

/* ─── Main document ───────────────────────────────────────────────── */
export function PronosticsPDF({ races, date }: { races: RaceAnalysis[]; date: string }) {
  const sorted = [...races].sort((a, b) =>
    a.startTime.localeCompare(b.startTime) ||
    a.reunionNumber - b.reunionNumber ||
    a.courseNumber - b.courseNumber,
  );

  /* group by reunion */
  const meetingMap = new Map<number, { name: string; racecourse: string; races: RaceAnalysis[] }>();
  for (const race of sorted) {
    if (!meetingMap.has(race.reunionNumber)) {
      meetingMap.set(race.reunionNumber, { name: `R${race.reunionNumber}`, racecourse: race.racecourse, races: [] });
    }
    meetingMap.get(race.reunionNumber)!.races.push(race);
  }
  const meetings = [...meetingMap.entries()].sort((a, b) => a[0] - b[0]);

  const reunionCount = meetings.length;
  const totalHorses  = races.reduce((t, r) => t + r.horses.length, 0);
  const todayLabel   = formatDate(date);

  let globalIdx = 0;

  return (
    <Document
      title={`Kayzen — Pronostics PMU ${date}`}
      author="Kayzen Turf AI"
      creator="Kayzen Turf AI"
      producer="@react-pdf/renderer"
    >
      <Page size="A4" style={s.page}>

        {/* Fixed header */}
        <View style={s.hdr} fixed>
          <View style={s.hdrLeft}>
            <View style={s.hdrBadge}><Text style={s.hdrBadgeTxt}>KZ</Text></View>
            <Text style={s.hdrTitle}>Kayzen</Text>
            <Text style={s.hdrSub}>  PRONOSTICS PMU — {date}</Text>
          </View>
          <Text style={s.hdrRight} render={({ pageNumber, totalPages }) => `p. ${pageNumber}/${totalPages}`} />
        </View>

        {/* Summary strip */}
        <View style={s.strip}>
          <Text style={s.stripTitle}>Pronostics du jour</Text>
          <Text style={s.stripDate}>{todayLabel}</Text>
          <View style={s.statBox}>
            <Text style={s.statVal}>{reunionCount}</Text>
            <Text style={s.statLbl}>Réunion{reunionCount > 1 ? "s" : ""}</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statVal}>{races.length}</Text>
            <Text style={s.statLbl}>Courses</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statVal}>{totalHorses}</Text>
            <Text style={s.statLbl}>Partants</Text>
          </View>
          <View style={s.warnBox}>
            <Text style={s.warnVal}>Aide à la décision</Text>
            <Text style={s.warnLbl}>Aucun gain garanti</Text>
          </View>
        </View>

        {/* Table header */}
        <View style={s.tblHead}>
          <Text style={[s.cCode, s.th]}>Code</Text>
          <Text style={[s.cHour, s.th]}>Heure</Text>
          <Text style={[s.cName, s.th]}>Course</Text>
          <Text style={[s.cDist, s.th]}>Dist.</Text>
          <Text style={[s.cOrdre, s.th]}>Ordre probable IA</Text>
          <Text style={[s.cTicket, s.th]}>Ticket</Text>
          <Text style={[s.cConf, s.th]}>Conf.</Text>
          <Text style={[s.cBase, s.th]}>Base</Text>
          <Text style={[s.cSignal, s.th]}>Signal</Text>
        </View>

        {/* Meetings + races */}
        {meetings.map(([reunionNum, meeting]) => (
          <View key={reunionNum}>
            <View style={s.meetingRow}>
              <Text style={s.meetingLabel}>R{reunionNum}</Text>
              <Text style={s.meetingName}>{meeting.racecourse}</Text>
              <Text style={s.meetingDate}>{meeting.races.length} course{meeting.races.length > 1 ? "s" : ""}</Text>
            </View>
            {meeting.races.map((race) => {
              const idx = globalIdx++;
              return <RaceRow key={race.id} race={race} idx={idx} />;
            })}
          </View>
        ))}

        {/* Fixed footer */}
        <View style={s.ftr} fixed>
          <Text style={s.ftrTxt}>
            Kayzen Turf AI — Outil d'aide à la décision uniquement. Les jeux d'argent comportent des risques.
          </Text>
          <Text style={s.ftrTxt}>{date}</Text>
        </View>

      </Page>
    </Document>
  );
}
