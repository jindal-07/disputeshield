import { NextResponse, connection } from "next/server";
import { read } from "@/lib/store";
import { sellerHealth } from "@/lib/health";
import { busy } from "@/lib/disputes";


export async function GET() {
  await connection(); // always read live state
  const db = read();
  const disputes = Object.values(db.disputes)
    .sort((a, b) => b.paypal.create_time.localeCompare(a.paypal.create_time))
    .map((d) => ({ ...d, working: busy(`assess:${d.id}`) || busy(`negotiate:${d.id}`) }));
  return NextResponse.json({
    orders: Object.values(db.orders).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    intents: db.intents,
    disputes,
    health: sellerHealth(),
  });
}
