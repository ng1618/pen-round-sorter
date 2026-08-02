import { NextResponse } from "next/server";
import { istAngemeldet } from "@/lib/auth";
import { neuerTag } from "@/lib/db/queries";

/**
 * Naechsten Spieltag anlegen. Passwort und Tokens haengen am Wochenende, es gibt
 * hier also nichts zu vererben — und die gedruckten QR-Codes gelten weiter.
 */
export async function POST() {
  if (!(await istAngemeldet())) {
    return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });
  }
  const ergebnis = neuerTag();
  if (!ergebnis.ok) return NextResponse.json({ fehler: ergebnis.fehler }, { status: 400 });
  return NextResponse.json({ ok: true, tag: ergebnis.tag });
}
