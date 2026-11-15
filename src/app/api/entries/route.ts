import { NextResponse } from "next/server";
import { istAngemeldet } from "@/lib/auth";
import { dbStore } from "@/lib/dbStore";
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
  return NextResponse.json(await dbStore.listEntries());
}

/** Offen fuer Gaeste auf /rank — deshalb wird hier geprueft und nicht vertraut. */
export async function POST(request: Request) {
  let rumpf: unknown;
  try {
    rumpf = await request.json();
  } catch {
    return NextResponse.json({ fehler: "🕯️ Der Bote brachte unleserliches Pergament." }, { status: 400 });
  }

  const runden = await dbStore.listRounds();
  const spielende = await dbStore.listEntries();
  const geprueft = pruefeEinreichung(
    rumpf,
    runden.map((r) => r.id),
    spielende.length,
  );
  if (!geprueft.ok) return NextResponse.json({ fehler: geprueft.fehler }, { status: 400 });

  return NextResponse.json(await dbStore.addEntry(geprueft.wert));
}
