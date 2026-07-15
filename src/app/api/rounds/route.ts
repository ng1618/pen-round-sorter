import { NextResponse } from "next/server";
import { serverStore } from "@/lib/serverStore";

export async function GET() {
  return NextResponse.json(await serverStore.listRounds());
}

export async function POST(request: Request) {
  const body = await request.json();
  const round = await serverStore.addRound(body);
  return NextResponse.json(round);
}
