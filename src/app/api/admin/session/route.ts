import { NextResponse } from "next/server";
import { neueBremse, passwortZuKurz, PASSWORT_MINDESTLAENGE } from "@/lib/anmeldung";
import {
  abmelden,
  anmelden,
  passwortGesetzt,
  passwortSetzen,
  ueberHttps,
  umgebungsPasswortZuKurz,
} from "@/lib/auth";

/** Eine Bremse fuer alle Anfragen — warum, steht an `neueBremse`. */
const bremse = neueBremse();

/**
 * POST = anmelden. Ist noch kein Passwort gesetzt, ist der erste POST die
 * Ersteinrichtung: das mitgeschickte Passwort wird uebernommen. Danach ist
 * dieser Weg zu, weil `passwortGesetzt()` dann wahr ist.
 */
export async function POST(request: Request) {
  let rumpf: unknown;
  try {
    rumpf = await request.json();
  } catch {
    return NextResponse.json({ fehler: "Anfrage nicht lesbar." }, { status: 400 });
  }
  const passwort = (rumpf as { passwort?: unknown } | null)?.passwort;
  if (typeof passwort !== "string" || passwort.length === 0) {
    return NextResponse.json({ fehler: "Passwort fehlt." }, { status: 400 });
  }

  // Pruefen und Zaehlen ohne ein `await` dazwischen, und vor dem teuren
  // scrypt. Erst nach `anmelden` zu zaehlen liess gleichzeitig abgeschickte
  // Anfragen alle an der Sperre vorbei (Gegenpruefung 15.11.). Deshalb zaehlt
  // jeder Versuch vorab als Fehlversuch; ein Erfolg nimmt das zurueck.
  const jetzt = Date.now();
  const warten = bremse.wartenMs(jetzt);
  if (warten > 0) {
    const sekunden = Math.ceil(warten / 1000);
    return NextResponse.json(
      { fehler: `Zu viele Fehlversuche. Bitte in ${sekunden} Sekunden noch einmal.` },
      { status: 429, headers: { "Retry-After": String(sekunden) } },
    );
  }

  const ersteinrichtung = !passwortGesetzt();
  if (!ersteinrichtung) bremse.fehlschlag(jetzt);
  if (ersteinrichtung) {
    // Steht ein zu kurzes Passwort in der Umgebung, bleibt das Formular zu:
    // sonst saesse auf Railway der offene Einrichtungsweg, den die Variable
    // gerade verhindern soll.
    if (umgebungsPasswortZuKurz()) {
      return NextResponse.json(
        {
          fehler: `PRS_ADMIN_PASSWORT ist kürzer als ${PASSWORT_MINDESTLAENGE} Zeichen und wurde nicht übernommen. Bitte in der Umgebung ändern und neu starten.`,
        },
        { status: 503 },
      );
    }
    // Die Mindestlaenge gilt nur beim Setzen — ein frueher gesetztes kuerzeres
    // Passwort meldet sich weiter an.
    if (passwortZuKurz(passwort)) {
      return NextResponse.json(
        { fehler: `Das Passwort braucht mindestens ${PASSWORT_MINDESTLAENGE} Zeichen.` },
        { status: 400 },
      );
    }
    passwortSetzen(passwort);
  }

  if (!(await anmelden(passwort, ueberHttps(request)))) {
    return NextResponse.json({ fehler: "Passwort stimmt nicht." }, { status: 401 });
  }
  bremse.erfolg();
  return NextResponse.json({ ok: true, ersteinrichtung });
}

/** DELETE = abmelden. */
export async function DELETE() {
  await abmelden();
  return NextResponse.json({ ok: true });
}
