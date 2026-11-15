import { NextResponse } from "next/server";
import { dbStore } from "@/lib/dbStore";
import { gleicheRunde, pruefeRunde, pruefeRundenFelder } from "@/lib/eingabe";

export async function GET() {
  return NextResponse.json(await dbStore.listRounds());
}

/** Offen fuer Gaeste auf /dm — deshalb wird hier geprueft und nicht vertraut. */
export async function POST(request: Request) {
  let rumpf: unknown;
  try {
    rumpf = await request.json();
  } catch {
    return NextResponse.json({ fehler: "🕯️ Der Bote brachte unleserliches Pergament." }, { status: 400 });
  }

  const vorhandene = await dbStore.listRounds();
  // Vor der Obergrenze pruefen: ein Doppeltipp bei 20 Runden soll die vorhandene
  // Runde bestaetigen, nicht "ausgebucht" melden.
  const felder = pruefeRundenFelder(rumpf);
  if (felder.ok) {
    const schonDa = gleicheRunde(vorhandene, felder.wert);
    if (schonDa) return NextResponse.json(schonDa);
  }

  const geprueft = pruefeRunde(rumpf, vorhandene.length);
  if (!geprueft.ok) return NextResponse.json({ fehler: geprueft.fehler }, { status: 400 });

  return NextResponse.json(await dbStore.addRound(geprueft.wert));
}
