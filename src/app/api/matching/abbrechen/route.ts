import { NextResponse } from "next/server";
import { istAngemeldet } from "@/lib/auth";
import { auslosungAbbrechen } from "@/lib/db/queries";

/**
 * Sperre ab dem Auslosen wieder aufheben — solange nichts festgelegt ist
 * (20.11.). Sonst friert ein zu frueher Klick den ganzen Abend ein.
 */
export async function POST() {
  if (!(await istAngemeldet())) {
    return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });
  }
  if (!auslosungAbbrechen()) {
    return NextResponse.json(
      { fehler: "Es ist schon ein Ergebnis festgelegt — abbrechen geht nicht mehr. Notfalls „Tag zurücksetzen“." },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
