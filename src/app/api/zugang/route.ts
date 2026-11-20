import { NextResponse } from "next/server";
import { gastPasswortGesetzt, gastZugelassen, istAngemeldet } from "@/lib/auth";
import { auslosungLaeuft } from "@/lib/db/queries";

/**
 * Offen: Was darf dieses Geraet gerade? Fuer `/rank`, `/dm` und den Tresen
 * (20.11.). Verraet nichts ausser Ja/Nein — kein Passwort, keine Daten.
 */
export async function GET() {
  return NextResponse.json({
    auslosungLaeuft: auslosungLaeuft(),
    gastPasswortGesetzt: gastPasswortGesetzt(),
    gastFrei: await gastZugelassen(),
    wirt: await istAngemeldet(),
  });
}
