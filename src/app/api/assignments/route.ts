import { NextResponse } from "next/server";

import { istAngemeldet } from "@/lib/auth";
import { dbStore } from "@/lib/dbStore";

/**
 * Lesen darf jeder — das Ergebnis soll am Ende ohnehin aushaengen. Aber nur
 * **wer an welchem Tisch** sitzt: die erhaltene Stufe ist ein Stueck des
 * Rankings und ueber den Aushang einem Namen zuzuordnen (Rollen-Review 15.11.).
 * Die volle Fassung bekommt nur die Verwaltung.
 */
export async function GET() {
  const zuordnungen = await dbStore.getAssignments();
  if (!zuordnungen || (await istAngemeldet())) return NextResponse.json(zuordnungen);
  return NextResponse.json(zuordnungen.map((z) => ({ ...z, receivedLevel: null })));
}

// Festgelegt wird ueber /api/matching/commit. Hier gibt es bewusst kein POST
// mehr: zwei Wege ins Schreiben waeren einer zu viel.
