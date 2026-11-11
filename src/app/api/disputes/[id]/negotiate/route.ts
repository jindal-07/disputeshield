import { NextResponse, after } from "next/server";
import { runNegotiation } from "@/lib/disputes";
import { agentBudget } from "@/lib/ratelimit";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const limited = agentBudget();
  if (limited) return limited;
  after(() => runNegotiation(id));
  return NextResponse.json({ started: true });
}
