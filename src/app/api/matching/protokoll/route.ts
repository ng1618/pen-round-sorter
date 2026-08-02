import { NextResponse } from "next/server";
import { istAngemeldet } from "@/lib/auth";
import { neuesterLaufVoll } from "@/lib/db/queries";
import { protokollText, type Auslosung } from "@/lib/protokoll";

/**
 * Protokoll des **festgelegten** Laufs — aus dessen eigenem Schnappschuss, nicht
 * aus dem heutigen Stand. Es soll beschreiben, was damals galt.
 *
 * Deshalb bewusst nicht dieselbe Quelle wie `/aktuell`: das baut den
 * Schnappschuss absichtlich neu auf, weil daraus ein neuer Lauf werden soll.
 */
export async function GET() {
  if (!(await istAngemeldet())) {
    return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });
  }

  const lauf = neuesterLaufVoll() as Auslosung | null;
  if (!lauf) {
    return NextResponse.json({ fehler: "Es wurde noch nichts festgelegt." }, { status: 404 });
  }

  return NextResponse.json({ protokoll: protokollText(lauf) });
}
