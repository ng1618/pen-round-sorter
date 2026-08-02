import { NextResponse } from "next/server";
import { istAngemeldet } from "@/lib/auth";
import { tagInfo, wochenendeAktualisieren } from "@/lib/db/queries";

const MAX_TAGE = 7;

/** Offen: auch Gaeste sollen sehen, fuer welchen Tag sie gerade eintragen. */
export async function GET() {
  return NextResponse.json(tagInfo());
}

export async function PATCH(request: Request) {
  if (!(await istAngemeldet())) {
    return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });
  }

  let rumpf: { name?: unknown; tage?: unknown };
  try {
    rumpf = await request.json();
  } catch {
    return NextResponse.json({ fehler: "🕯️ Der Bote brachte unleserliches Pergament." }, { status: 400 });
  }

  const name = typeof rumpf.name === "string" ? rumpf.name.trim() : "";
  if (name.length === 0 || name.length > 80) {
    return NextResponse.json(
      { fehler: "📜 Der Schreiber wartet — das Wochenende braucht einen Namen (höchstens 80 Zeichen)." },
      { status: 400 },
    );
  }
  if (!Number.isInteger(rumpf.tage) || (rumpf.tage as number) < 1 || (rumpf.tage as number) > MAX_TAGE) {
    return NextResponse.json(
      { fehler: `🗓️ Ein Wochenende hat zwischen 1 und ${MAX_TAGE} Tagen.` },
      { status: 400 },
    );
  }

  const ergebnis = wochenendeAktualisieren(name, rumpf.tage as number);
  if (!ergebnis.ok) return NextResponse.json({ fehler: ergebnis.fehler }, { status: 400 });
  return NextResponse.json({ ok: true });
}
