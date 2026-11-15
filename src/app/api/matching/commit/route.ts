import { NextResponse } from "next/server";
import { istAngemeldet } from "@/lib/auth";
import { commitLauf, listEntries, listRounds } from "@/lib/db/queries";
import { pruefeAuslosung, standAbgleich } from "@/lib/auslosung-pruefen";
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
  // speichern (ENTSCHEIDUNGEN.md, "Wann wird ein Lauf gespeichert").
  //
  // Verglichen wird WER, nicht wie viele (`standAbgleich`). Fehlt jemand aus
  // der Auslosung, gibt es kein "trotzdem": die Zuordnung zeigte sonst auf eine
  // geloeschte oder — nach Id-Wiedervergabe — auf eine fremde Person. Ohne
  // `veraltet` bietet die Oberflaeche dann auch nur die Fehlermeldung an.
  const abgleich = standAbgleich(a.eingabestand, listRounds(), listEntries());
  if (abgleich.art === "fehlt") {
    return NextResponse.json(
      {
        fehler:
          `Seit dem Auslosen ist etwas entfernt worden: ${abgleich.namen.join(", ")}. ` +
          `Diese Auslosung laesst sich nicht mehr festlegen — bitte neu auslosen.`,
      },
      { status: 409 },
    );
  }
  if (abgleich.art === "dazu" && !trotzdem) {
    const teile = [
      abgleich.namen.length > 0 ? `${abgleich.namen.length} Spielende (${abgleich.namen.join(", ")})` : "",
      abgleich.runden > 0 ? `${abgleich.runden} Runde(n)` : "",
    ].filter(Boolean);
    return NextResponse.json(
      {
        fehler:
          `Seit dem Auslosen dazugekommen: ${teile.join(" und ")}. ` +
          `Neu auslosen oder trotzdem festlegen (die Neuen bleiben dann ohne Platz)?`,
        veraltet: true,
      },
      { status: 409 },
    );
  }

  const laufId = commitLauf(a);
  return NextResponse.json({ ok: true, laufId });
}
