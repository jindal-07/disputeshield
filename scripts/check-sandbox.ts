// Day-1 check: confirms the PayPal sandbox and Claude are wired up before you build further.
// Run: npm run check
import { config } from "dotenv";
config({ path: ".env.local" });
config();

const ok = (m: string) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m: string) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);
const info = (m: string) => console.log(`    ${m}`);

async function main() {
  const pp = await import("../src/lib/paypal");
  let failures = 0;

  console.log("\nPayPal sandbox");
  try {
    const order = await pp.createOrder({
      amount: { currency_code: "USD", value: "1.00" },
      description: "DisputeShield connectivity check",
      sku: "CHECK",
      customId: "check",
    });
    ok(`OAuth + Orders API work (created order ${order.id}, status ${order.status})`);
  } catch (e) {
    failures++;
    bad(`Orders API: ${(e as Error).message}`);
  }

  try {
    const list = await pp.listDisputes();
    const items = list.items ?? [];
    ok(`Disputes API works (${items.length} dispute(s) on this seller account)`);
    for (const d of items.slice(0, 5)) {
      const full = await pp.getDispute(d.dispute_id);
      const actions = (full.links ?? []).filter((l) => l.method === "POST").map((l) => l.rel);
      info(`${d.dispute_id}  ${full.reason}  ${full.status}  $${full.dispute_amount.value}  actions: ${actions.join(", ") || "none"}`);
    }
    if (!items.length) {
      info("No disputes yet. To create one: buy something on /shop as the sandbox buyer, then log in to");
      info("https://www.sandbox.paypal.com as that buyer → Resolution Center → Report a problem.");
    }
  } catch (e) {
    failures++;
    bad(`Disputes API: ${(e as Error).message}`);
  }

  try {
    const hooks = await pp.paypal<{ webhooks: { url: string; event_types: { name: string }[] }[] }>("/v1/notifications/webhooks");
    const disputeHooks = hooks.webhooks.filter((w) => w.event_types.some((t) => t.name.startsWith("CUSTOMER.DISPUTE") || t.name === "*"));
    if (disputeHooks.length) ok(`Webhook for dispute events registered → ${disputeHooks.map((w) => w.url).join(", ")}`);
    else info("No dispute webhook registered (fine locally: the console polls PayPal every 30s).");
  } catch (e) {
    bad(`Webhooks API: ${(e as Error).message}`);
  }

  console.log("\nClaude");
  try {
    const { claude, MODEL } = await import("../src/lib/ai");
    const r = await claude().messages.create({
      model: MODEL,
      max_tokens: 200,
      messages: [{ role: "user", content: "Reply with the single word: ready" }],
    });
    const text = r.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    ok(`${MODEL} responded: ${text.trim()}`);
  } catch (e) {
    failures++;
    bad(`Claude: ${(e as Error).message}`);
  }

  console.log(failures ? `\n${failures} check(s) failed.\n` : "\nAll checks passed.\n");
  process.exit(failures ? 1 : 0);
}

main();
