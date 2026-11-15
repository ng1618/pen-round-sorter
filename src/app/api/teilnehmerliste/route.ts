import { NextResponse } from "next/server";
import { istAngemeldet } from "@/lib/auth";
import { teilnehmerliste } from "@/lib/db/queries";

/**
 * Anwesenheit ueber die Tage und Mehrfach-Alarm fuer den Tresen.
 *
 * **Nur angemeldet** — eine eigene Route statt eines Anhangs an
 * `GET /api/entries`, weil die offen ist. Wer an welchen Tagen da war und wer
 * sein Ranking geaendert hat, geht nur die Verwaltung etwas an; seit Railway
 * der Hauptweg ist, waere es sonst aus dem ganzen Netz abrufbar.
 */
export async function GET() {
  if (!(await istAngemeldet())) {
    return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });
  }
  return NextResponse.json(teilnehmerliste());
}
