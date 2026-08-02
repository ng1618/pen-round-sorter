import { NextResponse } from "next/server";
import { istAngemeldet } from "@/lib/auth";
import { rundeAktualisieren } from "@/lib/db/queries";
import { pruefeRundenFelder } from "@/lib/eingabe";

/**
 * Eine Runde aendern — Titel, Leitung, Stimmung, Plaetze.
 *
 * Nur die Verwaltung: auf `/dm` darf man anlegen, aber nichts Fremdes
 * ueberschreiben. Sonst genuegte eine geratene Id, um kurz vor der Auslosung
 * einen fremden Tisch umzubenennen.
 *
 * Geprueft wird mit derselben Funktion wie beim Anlegen. Zwei Pruefungen waeren
 * zwei Wahrheiten — ueber den Aenderungsweg landeten sonst Werte in der
 * Datenbank, die ueber den Anlegeweg abgelehnt wuerden.
 */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await istAngemeldet())) {
    return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });
  }

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ fehler: "🗺️ Diese Runde steht auf keiner Karte." }, { status: 400 });
  }

  let rumpf: unknown;
  try {
    rumpf = await request.json();
  } catch {
    return NextResponse.json({ fehler: "🕯️ Der Bote brachte unleserliches Pergament." }, { status: 400 });
  }

  const geprueft = pruefeRundenFelder(rumpf);
  if (!geprueft.ok) {
    return NextResponse.json({ fehler: geprueft.fehler }, { status: 400 });
  }

  if (!rundeAktualisieren(id, geprueft.wert)) {
    return NextResponse.json({ fehler: "🗺️ Diese Runde steht auf keiner Karte." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
