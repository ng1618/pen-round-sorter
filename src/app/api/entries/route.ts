import { NextResponse } from "next/server";
import { dbStore } from "@/lib/dbStore";
import { pruefeEinreichung } from "@/lib/eingabe";

export async function GET() {
  return NextResponse.json(await dbStore.listEntries());
}

/** Offen fuer Gaeste auf /rank — deshalb wird hier geprueft und nicht vertraut. */
export async function POST(request: Request) {
  let rumpf: unknown;
  try {
    rumpf = await request.json();
  } catch {
    return NextResponse.json({ fehler: "Kein gültiges JSON." }, { status: 400 });
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
