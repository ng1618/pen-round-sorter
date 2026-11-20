import { NextResponse } from "next/server";
import { istAngemeldet } from "@/lib/auth";
import { auslosungLaeuft, commitLauf, listEntries, listRounds } from "@/lib/db/queries";
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

  // Abgesichert wie in allen anderen Routen (20.11.): eine abgeschnittene
  // Anfrage bei schwachem WLAN am Tresen endete hier als nichtssagender 500.
  // Bewusst nuechtern statt im Wirtshaus-Ton — es geht um das Ergebnis.
  let rumpf: { auslosung?: Auslosung; trotzdem?: boolean };
  try {
    rumpf = (await request.json()) as typeof rumpf;
  } catch {
    return NextResponse.json(
      { fehler: "Anfrage nicht lesbar. Die Auslosung wurde NICHT gespeichert — bitte noch einmal festlegen." },
      { status: 400 },
    );
  }
  const { auslosung, trotzdem } = rumpf ?? {};

  // Ab hier synchron. Ohne laufende Sperre war die Vorschau abgebrochen (etwa
  // in einem zweiten Tab), und inzwischen kann ein Gast unter demselben Namen
  // neu eingereicht haben — Id und Name gleich, `standAbgleich` saehe nichts
  // (Rollen-Review 20.11.).
  if (!auslosungLaeuft()) {
    return NextResponse.json(
      { fehler: "Die Auslosung wurde inzwischen abgebrochen. Diese Vorschau gilt nicht mehr — bitte neu auslosen." },
      { status: 409 },
    );
  }

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
