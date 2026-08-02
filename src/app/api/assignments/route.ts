import { NextResponse } from "next/server";

import { dbStore } from "@/lib/dbStore";

/** Lesen darf jeder — das Ergebnis soll am Ende ohnehin aushaengen. */
export async function GET() {
  return NextResponse.json(await dbStore.getAssignments());
}

// Festgelegt wird ueber /api/matching/commit. Hier gibt es bewusst kein POST
// mehr: zwei Wege ins Schreiben waeren einer zu viel.
