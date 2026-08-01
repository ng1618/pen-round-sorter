import { NextResponse } from "next/server";
import { dbStore } from "@/lib/dbStore";

export async function GET() {
  return NextResponse.json(await dbStore.listRounds());
}

export async function POST(request: Request) {
  const body = await request.json();
  const round = await dbStore.addRound(body);
  return NextResponse.json(round);
}
