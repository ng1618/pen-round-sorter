import { NextResponse } from "next/server";
import { istAngemeldet } from "@/lib/auth";
import { setRundenPlaetze } from "@/lib/db/queries";

const MAX_PLAETZE = 20;

/** Platzzahl anpassen. Nur die Verwaltung — siehe Kommentar an `setRundenPlaetze`. */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await istAngemeldet())) {
    return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });
  }

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ fehler: "Ungültige id." }, { status: 400 });
  }

  let plaetze: unknown;
  try {
    ({ plaetze } = (await request.json()) as { plaetze?: unknown });
  } catch {
    return NextResponse.json({ fehler: "Kein gültiges JSON." }, { status: 400 });
  }

  // Vor der Datenbank pruefen, damit aus einer CHECK-Verletzung ein 400 wird
  // und kein 500.
  if (!Number.isInteger(plaetze) || (plaetze as number) < 1 || (plaetze as number) > MAX_PLAETZE) {
    return NextResponse.json(
      { fehler: `Platzzahl muss zwischen 1 und ${MAX_PLAETZE} liegen.` },
      { status: 400 },
    );
  }

  if (!setRundenPlaetze(id, plaetze as number)) {
    return NextResponse.json({ fehler: "Runde nicht gefunden." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
