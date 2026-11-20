import { NextResponse } from "next/server";
import { gastFreischalten, ueberHttps } from "@/lib/auth";

/**
 * Gast-Passwort eingeben, einmal je Geraet. Ohne Sperre nach Fehlversuchen —
 * eine Sperre gaelte fuer alle Gaeste gemeinsam (Festlegung 20.11.).
 */
export async function POST(request: Request) {
  let rumpf: { passwort?: unknown } | null;
  try {
    rumpf = await request.json();
  } catch {
    return NextResponse.json({ fehler: "Anfrage nicht lesbar." }, { status: 400 });
  }
  if (typeof rumpf?.passwort !== "string" || !(await gastFreischalten(rumpf.passwort, ueberHttps(request)))) {
    return NextResponse.json({ fehler: "Das Passwort stimmt nicht. Frag am Tresen nach." }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
