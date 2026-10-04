import { ImageResponse } from "next/og";
import { MARQUE_DATA_URI, MARQUE_RATIO } from "@/lib/brand-mark";
import { properName } from "@/lib/format";
import { adresseAppelant, limiterDebit, reponseTropDeRequetes } from "@/lib/rate-limit";
import { getRaceById } from "@/lib/race-repository";
import { parseTicketParams } from "@/lib/ticket-format";

/**
 * IMAGE D'UN TICKET — /races/[id]/ticket?t=4-8-2-11-6&k=Quinté%2B
 *
 * Même rendu que l'image de partage du site (src/app/opengraph-image.tsx).
 * Les deux paramètres sont validés strictement (lib/ticket-format) et la
 * course doit exister : une URL forgée ne peut pas faire écrire un texte
 * libre sous la marque du site. Toute entrée invalide répond 400 ou 404.
 */

const SIZE = { width: 1200, height: 630 };

const dateLongue = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function formatDate(raceDate: string) {
  const [year, month, day] = raceDate.split("-").map(Number);
  if (!year || !month || !day) return raceDate;
  return dateLongue.format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function safeDecode(id: string): string | null {
  try {
    return decodeURIComponent(id);
  } catch {
    return null;
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Rendu coûteux en calcul : chaque combinaison t/k échappe au cache.
  const limite = limiterDebit(`ticket:${adresseAppelant(request)}`, 30, 10 * 60_000);
  if (!limite.autorise) return reponseTropDeRequetes(limite);
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const parsed = parseTicketParams(searchParams.get("t"), searchParams.get("k"));
  if (!parsed) return new Response("Ticket invalide", { status: 400 });

  const race = await getRaceById(safeDecode(id));
  if (!race) return new Response("Course introuvable", { status: 404 });
  // Le libellé doit être celui d'un pari réellement proposé sur la course :
  // aucun texte libre (« Gain garanti ») sous la marque du site.
  if (!race.betTypes.some((offer) => offer.label === parsed.label)) return new Response("Pari inconnu", { status: 400 });

  const numbers = parsed.ticket.replace(/ ordre$/, "").split("-");
  const ordered = parsed.ticket.endsWith(" ordre");
  const fontSize = numbers.length > 8 ? 64 : 96;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 80px",
          background: "linear-gradient(135deg, #0c2318 0%, #123a26 55%, #0a1c12 100%)",
          color: "#e2ede5",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {/* Satori ne résout pas les chemins du site : la marque arrive en data URI. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={MARQUE_DATA_URI} alt="" width={96} height={Math.round(96 / MARQUE_RATIO)} />
            <div style={{ display: "flex", fontSize: 24, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", color: "#7fd9a2" }}>Kayzen Turf</div>
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#a7c9b4" }}>
            {race.programCode} · {properName(race.racecourse)} · {formatDate(race.raceDate)}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: "#c8e2d3" }}>
            {parsed.label}
            {ordered ? " — ordre exact" : ""}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
            {numbers.map((n, i) => (
              <div
                key={`${n}-${i}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: fontSize * 1.4,
                  height: fontSize * 1.4,
                  padding: "0 18px",
                  borderRadius: 24,
                  background: n === "X" ? "rgba(226,237,229,0.12)" : "#e2ede5",
                  color: n === "X" ? "#e2ede5" : "#0c2318",
                  fontSize,
                  fontWeight: 700,
                }}
              >
                {n}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#a7c9b4" }}>{properName(race.name)} — départ {race.startTime}</div>
        </div>

        <div style={{ display: "flex", fontSize: 22, color: "#7fd9a2", fontWeight: 700 }}>
          Aide à la décision, aucun gain garanti — jouer comporte des risques. 18+
        </div>
      </div>
    ),
    {
      ...SIZE,
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" },
    },
  );
}
