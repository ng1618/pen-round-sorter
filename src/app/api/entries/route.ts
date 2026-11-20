import { NextResponse } from "next/server";
import { gastZugelassen, istAngemeldet } from "@/lib/auth";
import { addEntry, auslosungLaeuft, listEntries, listRounds } from "@/lib/db/queries";
import { pruefeEinreichung } from "@/lib/eingabe";

/**
 * Lesen nur angemeldet: hier stehen alle Namen samt Rankings, und seit Railway
 * der Hauptweg ist, waere das vor der Auslosung aus dem ganzen Netz lesbar.
 * Gelesen wird es nur von der Verwaltung (Tresen, Auslosung).
 */
export async function GET() {
  if (!(await istAngemeldet())) {
    return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });
  }
  return NextResponse.json(listEntries());
}

/**
 * Gaeste auf /rank — deshalb wird hier geprueft und nicht vertraut.
 *
 * Seit dem 20.11. zwei Schranken: das Gast-Passwort (falls gesetzt) und die
 * Sperre ab dem Auslosen. Der Wirt kommt durch beide, damit Nachzuegler am
 * Tresen noch eingetragen werden koennen; beim Festlegen fragt dann die
 * bekannte Rueckfrage „dazugekommen".
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

  // Ab hier synchron, ohne `await`: Sperre pruefen und schreiben in einem Zug.
  // Sonst koennte eine Einreichung zwischen Pruefung und Schnappschuss des
  // Auslosens hineinrutschen — genau der stille Verlust, den die Sperre
  // verhindern soll.
  if (!wirt && auslosungLaeuft()) {
    return NextResponse.json(
      { fehler: "Die Auslosung läuft schon — bitte am Tresen melden.", gesperrt: true },
      { status: 423 },
    );
  }
  const runden = listRounds();
  const geprueft = pruefeEinreichung(
    rumpf,
    runden.map((r) => r.id),
    listEntries().length,
  );
  if (!geprueft.ok) return NextResponse.json({ fehler: geprueft.fehler }, { status: 400 });

  return NextResponse.json(addEntry(geprueft.wert));
}
