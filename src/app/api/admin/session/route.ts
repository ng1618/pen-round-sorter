import { NextResponse } from "next/server";
import { abmelden, anmelden, passwortGesetzt, passwortSetzen, ueberHttps } from "@/lib/auth";

/**
 * POST = anmelden. Ist noch kein Passwort gesetzt, ist der erste POST die
 * Ersteinrichtung: das mitgeschickte Passwort wird uebernommen. Danach ist
 * dieser Weg zu, weil `passwortGesetzt()` dann wahr ist.
 */
export async function POST(request: Request) {
  const { passwort } = (await request.json()) as { passwort?: unknown };
  if (typeof passwort !== "string" || passwort.length < 4) {
    return NextResponse.json({ fehler: "Passwort fehlt oder ist zu kurz." }, { status: 400 });
  }

  const ersteinrichtung = !passwortGesetzt();
  if (ersteinrichtung) passwortSetzen(passwort);

  if (!(await anmelden(passwort, ueberHttps(request)))) {
    return NextResponse.json({ fehler: "Passwort stimmt nicht." }, { status: 401 });
  }
  return NextResponse.json({ ok: true, ersteinrichtung });
}

/** DELETE = abmelden. */
export async function DELETE() {
  await abmelden();
  return NextResponse.json({ ok: true });
}
