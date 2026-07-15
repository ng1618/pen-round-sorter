import { NextResponse } from "next/server";
import { serverStore } from "@/lib/serverStore";

export async function GET() {
  return NextResponse.json(await serverStore.getAssignments());
}

export async function POST(request: Request) {
  const assignments = await request.json();
  await serverStore.saveAssignments(assignments);
  return NextResponse.json({ ok: true });
}
