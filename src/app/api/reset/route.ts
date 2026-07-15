import { NextResponse } from "next/server";
import { serverStore } from "@/lib/serverStore";

export async function POST() {
  await serverStore.resetAll();
  return NextResponse.json({ ok: true });
}
