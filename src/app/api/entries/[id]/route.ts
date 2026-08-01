import { NextResponse } from "next/server";
import { istAngemeldet } from "@/lib/auth";
import { deleteSpieler } from "@/lib/db/queries";

/** Absage am Eventabend. Nur fuer die Verwaltung. */
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await istAngemeldet())) {
    return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });
  }

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ fehler: "Ungültige id." }, { status: 400 });
  }
  if (!deleteSpieler(id)) {
    return NextResponse.json({ fehler: "Nicht gefunden." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
