// Buyer's AI shopping agent: turns a plain-language request into a PayPal order and a purchase-intent record.
// The human still approves the payment in PayPal's own checkout window — the agent never holds credentials.
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { randomUUID } from "crypto";
import { claude, baseParams } from "../ai";
import * as pp from "../paypal";
import { CATALOG, getProduct, SHOP_NAME } from "../catalog";
import { update, now, type PurchaseIntent } from "../store";

const SYSTEM = `You are a personal AI shopping agent. Your human tells you what they want; you find it in the "${SHOP_NAME}" shop and prepare a PayPal checkout for them to approve.
Use search_catalog, then call prepare_checkout exactly once with the single best match.
Record every constraint the human gave (size, colour, budget, use) — the record is your signed purchase intent and will be shown to the seller if anything goes wrong.
Work fast like a real shopping agent: pick the closest match to the literal request.
Reply to the human in one or two sentences after preparing checkout.`;

export type ShoppingResult = {
  reply: string;
  intent?: PurchaseIntent;
  paypalOrderId?: string;
};

export async function shop(userRequest: string): Promise<ShoppingResult> {
  let intent: PurchaseIntent | undefined;
  let paypalOrderId: string | undefined;

  const search = betaZodTool({
    name: "search_catalog",
    description: "List the shop's products with price, attributes and the listing description.",
    inputSchema: z.object({ query: z.string() }),
    run: async () => JSON.stringify(CATALOG),
  });

  const prepare = betaZodTool({
    name: "prepare_checkout",
    description: "Create the PayPal order for the chosen product and record the purchase intent.",
    inputSchema: z.object({
      sku: z.string(),
      constraints: z.array(z.string()).describe("Every constraint the human stated, e.g. 'size M', 'blue', 'under $40'"),
      budgetUsd: z.string().optional(),
      reasoning: z.string().describe("Why this product matches the request"),
    }),
    run: async (input) => {
      const product = getProduct(input.sku);
      if (!product) return "Unknown SKU — search again.";
      if (intent) return "Checkout already prepared.";
      const id = `intent_${randomUUID().slice(0, 8)}`;
      const amount = { currency_code: "USD", value: product.price };
      const order = await pp.createOrder({ amount, description: product.name, sku: product.sku, customId: id });
      paypalOrderId = order.id;
      intent = {
        id,
        userRequest,
        budget: input.budgetUsd ? { currency_code: "USD", value: input.budgetUsd } : undefined,
        constraints: input.constraints,
        chosenSku: product.sku,
        agentReasoning: input.reasoning,
        createdAt: now(),
      };
      const saved = intent;
      update((db) => {
        db.intents[id] = saved;
        db.orders[order.id] = {
          id: order.id,
          sku: product.sku,
          itemName: product.name,
          amount,
          status: "CREATED",
          intentId: id,
          createdAt: now(),
        };
      });
      return `PayPal order ${order.id} created for ${product.name} at $${product.price}. Waiting for the human to approve in PayPal.`;
    },
  });

  const final = await claude().beta.messages.toolRunner({
    ...baseParams(),
    system: SYSTEM,
    tools: [search, prepare],
    messages: [{ role: "user", content: userRequest }],
    max_iterations: 6,
  });

  const reply = final.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return { reply: reply || "Checkout is ready for your approval.", intent, paypalOrderId };
}
