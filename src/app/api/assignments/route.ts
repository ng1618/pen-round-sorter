import { NextResponse } from "next/server";
import { istAngemeldet } from "@/lib/auth";
import { dbStore } from "@/lib/dbStore";

/** Lesen darf jeder — das Ergebnis soll am Ende ohnehin aushaengen. */
export async function GET() {
  return NextResponse.json(await dbStore.getAssignments());
}

/** Festlegen ist Sache des Wirts. */
export async function POST(request: Request) {
  if (!(await istAngemeldet())) {
    return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });
  }
  const assignments = await request.json();
  await dbStore.saveAssignments(assignments);
  return NextResponse.json({ ok: true });
}
