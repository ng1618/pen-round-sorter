import { NextResponse } from "next/server";
import { dbStore } from "@/lib/dbStore";

export async function GET() {
  return NextResponse.json(await dbStore.listEntries());
}

export async function POST(request: Request) {
  const body = await request.json();
  const entry = await dbStore.addEntry(body);
  return NextResponse.json(entry);
}
