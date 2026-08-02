import { NextResponse } from "next/server";
import { istAngemeldet } from "@/lib/auth";
import { commitLauf, listEntries, listRounds } from "@/lib/db/queries";
import { levelVon, type Auslosung } from "@/lib/protokoll";

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

  const fehler = pruefen(auslosung);
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

/** Prueft die Auslosung gegen ihren eigenen Schnappschuss, nicht gegen den Live-Stand. */
function pruefen(a: Auslosung | undefined): string | null {
  if (!a?.eingabestand?.runden || !a.eingabestand.spieler || !Array.isArray(a.zuordnungen)) {
    return "Auslosung unvollstaendig.";
  }

  const runden = new Map(a.eingabestand.runden.map((r) => [r.id, r]));
  const spieler = new Map(a.eingabestand.spieler.map((s) => [s.id, s]));
  const gesehen = new Set<number>();
  const belegt = new Map<number, number>();

  for (const z of a.zuordnungen) {
    const person = spieler.get(z.playerId);
    if (!person) return `Unbekannte Person ${z.playerId}.`;
    if (gesehen.has(z.playerId)) return `Person ${z.playerId} kommt doppelt vor.`;
    gesehen.add(z.playerId);

    if (z.roundId == null) {
      if (z.receivedLevel != null) return `Person ${z.playerId}: ohne Platz, aber mit Level.`;
      continue;
    }

    const runde = runden.get(z.roundId);
    if (!runde) return `Unbekannte Runde ${z.roundId}.`;

    // Das Level wird nachgerechnet und nicht geglaubt — sonst koennte eine
    // Handkorrektur spaeter in der Statistik besser aussehen als sie war.
    const erwartet = levelVon(person, z.roundId);
    if (z.receivedLevel !== erwartet) {
      return `Person ${z.playerId}: Level ${z.receivedLevel} passt nicht zu ihrer Angabe (${erwartet}).`;
    }

    const n = (belegt.get(z.roundId) ?? 0) + 1;
    belegt.set(z.roundId, n);
    if (n > runde.capacity) return `Runde "${runde.title}" waere mit ${n} von ${runde.capacity} ueberbelegt.`;
  }

  return null;
}
