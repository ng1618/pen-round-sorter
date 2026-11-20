import { NextResponse } from "next/server";
import { gastZugelassen, istAngemeldet } from "@/lib/auth";
import { addRound, auslosungLaeuft, listRounds } from "@/lib/db/queries";
import { gleicheRunde, pruefeRunde, pruefeRundenFelder } from "@/lib/eingabe";

/** Offen: nur Titel, Leitung, Stimmung und Plaetze. */
export async function GET() {
  return NextResponse.json(listRounds());
}

/**
 * Leitungen auf /dm — deshalb wird hier geprueft und nicht vertraut.
 *
 * Seit dem 20.11. hinter dem Gast-Passwort (falls gesetzt), und ab dem
 * Auslosen fuer Gaeste geschlossen: eine neue Runde koennte dann niemand mehr
 * ranken.
 */
export async function POST(request: Request) {
  if (!(await gastZugelassen())) {
    return NextResponse.json({ fehler: "Bitte zuerst das Gast-Passwort eingeben.", gastPasswort: true }, { status: 401 });
  }
  const wirt = await istAngemeldet();

  let rumpf: unknown;
  try {
    rumpf = await request.json();
  } catch {
    return NextResponse.json({ fehler: "🕯️ Der Bote brachte unleserliches Pergament." }, { status: 400 });
  }

  if (!wirt && auslosungLaeuft()) {
    return NextResponse.json(
      { fehler: "Die Auslosung läuft schon — neue Runden bitte am Tresen melden.", gesperrt: true },
      { status: 423 },
    );
  }

  const vorhandene = listRounds();
  // Vor der Obergrenze pruefen: ein Doppeltipp bei 20 Runden soll die vorhandene
  // Runde bestaetigen, nicht "ausgebucht" melden.
  const felder = pruefeRundenFelder(rumpf);
  if (felder.ok) {
    const schonDa = gleicheRunde(vorhandene, felder.wert);
    if (schonDa) return NextResponse.json(schonDa);
  }

  const geprueft = pruefeRunde(rumpf, vorhandene.length);
  if (!geprueft.ok) return NextResponse.json({ fehler: geprueft.fehler }, { status: 400 });

  return NextResponse.json(addRound(geprueft.wert));
}
