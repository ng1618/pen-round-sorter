import { NextResponse } from "next/server";
import { istAngemeldet } from "@/lib/auth";
import { commitLauf, listEntries, listRounds } from "@/lib/db/queries";
import { pruefeAuslosung } from "@/lib/auslosung-pruefen";
import { type Auslosung } from "@/lib/protokoll";

/**
 * Eine Auslosung festlegen. Erst hier entsteht eine Zeile — verworfene Wuerfe
 * hat es nie gegeben.
 */
export async function POST(request: Request) {
  if (!(await istAngemeldet())) {
    return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });
  }

  const { auslosung, trotzdem } = (await request.json()) as {
    auslosung?: Auslosung;
    trotzdem?: boolean;
  };

  const fehler = pruefeAuslosung(auslosung);
  if (fehler) return NextResponse.json({ fehler }, { status: 400 });
  const a = auslosung as Auslosung;

  // Haben sich die Daten seit dem Auslosen bewegt? Dann nicht stillschweigend
  // speichern, sondern fragen (ENTSCHEIDUNGEN.md, "Wann wird ein Lauf
  // gespeichert").
  if (!trotzdem) {
    const jetztRunden = listRounds().length;
    const jetztSpieler = listEntries().length;
    if (
      jetztRunden !== a.eingabestand.runden.length ||
      jetztSpieler !== a.eingabestand.spieler.length
    ) {
      return NextResponse.json(
        {
          fehler:
            `Seit dem Auslosen hat sich etwas geaendert: jetzt ${jetztRunden} Runden und ` +
            `${jetztSpieler} Spielende statt ${a.eingabestand.runden.length} und ` +
            `${a.eingabestand.spieler.length}. Neu auslosen oder trotzdem festlegen?`,
          veraltet: true,
        },
        { status: 409 },
      );
    }
  }

  const laufId = commitLauf(a);
  return NextResponse.json({ ok: true, laufId });
}
