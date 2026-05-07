import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { getRaces } from "@/lib/race-repository";
import { PronosticsPDF } from "@/lib/pronostics-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parisToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? parisToday();

  const races = await getRaces({ date });

  if (!races.length) {
    return NextResponse.json(
      { error: `Aucune course disponible pour le ${date}` },
      { status: 404 },
    );
  }

  const buffer = await renderToBuffer(<PronosticsPDF races={races} date={date} />);

  const filename = `kayzen-pronostics-${date}.pdf`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control":       "no-store",
    },
  });
}
