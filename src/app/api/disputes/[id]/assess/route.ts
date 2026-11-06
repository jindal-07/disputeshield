import { NextResponse, after } from "next/server";
import { runAssessment } from "@/lib/disputes";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  after(() => runAssessment(id));
  return NextResponse.json({ started: true });
}
