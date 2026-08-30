import { NextResponse } from "next/server";
import { istAngemeldet } from "@/lib/auth";
import { einstellungen, einstellungenSetzen } from "@/lib/db/queries";
import type { Einstellungen } from "@/lib/types";

/**
 * Die Einstellungen des Wochenendes.
 *
 * **Beide Richtungen nur angemeldet** — anders als `GET /api/wochenende`, das
 * offen ist, damit Gäste sehen, für welchen Tag sie eintragen. Der Unterschied
 * ist kein Formalismus: dass gerade das **Optimum** läuft, ist eine Information,
 * mit der man das Verfahren austricksen kann (es ist nicht manipulationsfest —
 * siehe `ENTSCHEIDUNGEN.md` vom 30.08.). Nach der Auslosung steht es ohnehin im
 * Protokoll; vorher geht es niemanden an.
 */
export async function GET() {
  if (!(await istAngemeldet())) {
    return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });
  }
  return NextResponse.json(einstellungen());
}

/**
 * Was **gebaut** ist — nicht, was der Typ erlaubt. Ein Verfahren darf erst
 * waehlbar sein, wenn es auch laeuft: sonst schriebe der Lauf einen Namen in
 * seine Konfiguration, unter dem gar nicht gerechnet wurde — eine Falschaussage
 * genau auf dem Blatt, das die Nachvollziehbarkeit tragen soll.
 */
const VERFAHREN_GEBAUT = ["rsd", "leximin"];

export async function PATCH(request: Request) {
  if (!(await istAngemeldet())) {
    return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });
  }

  let rumpf: Record<string, unknown>;
  try {
    rumpf = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ fehler: "🕯️ Der Bote brachte unleserliches Pergament." }, { status: 400 });
  }

  // Nur bekannte Felder übernehmen. Ein unbekannter Schlüssel landete sonst in
  // der JSON-Spalte und sähe beim nächsten Lesen wie eine Einstellung aus.
  const teil: Partial<Einstellungen> = {};

  if ("verfahren" in rumpf) {
    if (typeof rumpf.verfahren !== "string" || !VERFAHREN_GEBAUT.includes(rumpf.verfahren)) {
      return NextResponse.json(
        { fehler: `🎲 Dieses Verfahren steht nicht zur Wahl: ${String(rumpf.verfahren)}.` },
        { status: 400 },
      );
    }
    teil.verfahren = rumpf.verfahren as Einstellungen["verfahren"];
  }

  if ("ausgleichUeberTage" in rumpf) {
    if (typeof rumpf.ausgleichUeberTage !== "boolean") {
      return NextResponse.json(
        { fehler: "🎲 „Ausgleich über die Tage“ ist ein Schalter — an oder aus." },
        { status: 400 },
      );
    }
    teil.ausgleichUeberTage = rumpf.ausgleichUeberTage;
  }

  return NextResponse.json(einstellungenSetzen(teil));
}
