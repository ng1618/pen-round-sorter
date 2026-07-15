import { NextResponse } from "next/server";
import { serverStore } from "@/lib/serverStore";

export async function GET() {
  return NextResponse.json(await serverStore.listEntries());
}

export async function POST(request: Request) {
  const body = await request.json();
  const entry = await serverStore.addEntry(body);
  return NextResponse.json(entry);
}
