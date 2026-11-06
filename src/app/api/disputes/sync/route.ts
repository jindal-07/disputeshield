import { NextResponse, after } from "next/server";
import { syncFromPayPal, runAssessment } from "@/lib/disputes";
import { read } from "@/lib/store";
import { fail } from "@/lib/http";

// Polls PayPal for disputes (useful locally, where PayPal webhooks can't reach you).
export async function POST() {
  try {
    const fresh = await syncFromPayPal();
    const unassessed = Object.values(read().disputes)
      .filter((d) => !d.assessment)
      .map((d) => d.id);
    after(async () => {
      for (const id of unassessed) await runAssessment(id);
    });
    return NextResponse.json({ new: fresh, assessing: unassessed });
  } catch (e) {
    return fail(e);
  }
}
