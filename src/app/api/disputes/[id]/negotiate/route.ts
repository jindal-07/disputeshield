import { NextResponse, after } from "next/server";
import { runNegotiation } from "@/lib/disputes";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  after(() => runNegotiation(id));
  return NextResponse.json({ started: true });
}
