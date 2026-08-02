import { NextResponse } from "next/server";
import { dbStore } from "@/lib/dbStore";
import { pruefeRunde } from "@/lib/eingabe";

export async function GET() {
  return NextResponse.json(await dbStore.listRounds());
}

/** Offen fuer Gaeste auf /dm — deshalb wird hier geprueft und nicht vertraut. */
export async function POST(request: Request) {
  let rumpf: unknown;
  try {
    rumpf = await request.json();
  } catch {
    return NextResponse.json({ fehler: "Kein gültiges JSON." }, { status: 400 });
  }

  const vorhandene = await dbStore.listRounds();
  const geprueft = pruefeRunde(rumpf, vorhandene.length);
  if (!geprueft.ok) return NextResponse.json({ fehler: geprueft.fehler }, { status: 400 });

  return NextResponse.json(await dbStore.addRound(geprueft.wert));
}
