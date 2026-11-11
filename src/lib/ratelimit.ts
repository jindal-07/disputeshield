import { NextResponse } from "next/server";

// Protects the Claude bill on a public demo: caps agent runs per rolling hour across all visitors.
// In-memory is enough for a single Render instance. Set AGENT_RUNS_PER_HOUR=0 to disable the cap.
const LIMIT = Number(process.env.AGENT_RUNS_PER_HOUR ?? "40");
const WINDOW_MS = 60 * 60 * 1000;
const runs: number[] = [];

/** Returns a 429 response if the hourly agent budget is spent, otherwise records the run and returns null. */
export function agentBudget(): NextResponse | null {
  if (LIMIT <= 0) return null;
  const now = Date.now();
  while (runs.length && runs[0] < now - WINDOW_MS) runs.shift();
  if (runs.length >= LIMIT) {
    const retryMin = Math.ceil((runs[0] + WINDOW_MS - now) / 60000);
    return NextResponse.json(
      { error: `The demo's AI agents are busy (hourly limit reached). Try again in about ${retryMin} min.` },
      { status: 429 },
    );
  }
  runs.push(now);
  return null;
}
