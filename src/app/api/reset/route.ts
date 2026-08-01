import { NextResponse } from "next/server";
import { istAngemeldet } from "@/lib/auth";
import { dbStore } from "@/lib/dbStore";

export async function POST() {
  if (!(await istAngemeldet())) {
    return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });
  }
  await dbStore.resetAll();
  return NextResponse.json({ ok: true });
}
