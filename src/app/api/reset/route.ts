import { NextResponse } from "next/server";
import { istAngemeldet, passwortStimmt } from "@/lib/auth";
import { resetAll, wochenendeZuruecksetzen } from "@/lib/db/queries";

/**
 * Zuruecksetzen: `umfang: "tag"` leert den aktuellen Tag (fruehere bleiben),
 * `umfang: "wochenende"` leert alle Tage und laesst ein leeres Tag 1 stehen.
 *
 * Verlangt neben der Sitzung das Passwort im Rumpf (20.11.). Beides loescht
 * Ergebnisse, die sich nicht wiederherstellen lassen.
 */
export async function POST(request: Request) {
  if (!(await istAngemeldet())) {
    return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });
  }

  let rumpf: { passwort?: unknown; umfang?: unknown };
  try {
    rumpf = await request.json();
  } catch {
    return NextResponse.json({ fehler: "Anfrage nicht lesbar." }, { status: 400 });
  }

  if (typeof rumpf.passwort !== "string" || !passwortStimmt(rumpf.passwort)) {
    return NextResponse.json({ fehler: "Passwort stimmt nicht." }, { status: 403 });
  }

  if (rumpf.umfang === "tag") resetAll();
  else if (rumpf.umfang === "wochenende") wochenendeZuruecksetzen();
  else return NextResponse.json({ fehler: "Unbekannter Umfang." }, { status: 400 });

  return NextResponse.json({ ok: true });
}
