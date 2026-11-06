# DisputeShield

**AI agents that prevent, fight and settle PayPal disputes for small sellers, and that can settle with the buyer's own AI shopping agent.**

AI shopping agents are starting to buy on people's behalf. They will buy the wrong size, miss a line in a listing, or go over budget, and the result is a dispute. For a small seller every dispute costs time and fees, and a rising dispute ratio can lead to an account review and funds held for up to 180 days.

DisputeShield gives the seller an agent that:

1. **Investigates** each PayPal dispute using the PayPal Disputes, Orders and Tracking data, the product listing, and (when an AI agent made the purchase) the buyer agent's purchase-intent record.
2. **Recommends** Fight, Settle or Accept, with a win probability, a Seller Protection check and drafted evidence.
3. **Negotiates** a settlement with the buyer's shopping agent over a small open protocol (Agent Dispute Protocol). When the seller approves, the agreed offer is sent with PayPal `make-offer`, with a summary of the negotiation as its note.
4. **Acts only when the seller approves**: one click sends the offer (`make-offer`), the evidence (`provide-evidence`) or the acceptance (`accept-claim`) through the PayPal Disputes API.

It also includes the buyer side: a shopping agent that turns "buy me a blue hoodie in M under $40" into a PayPal Checkout the human approves, and stores exactly what the human asked for.

## PayPal APIs used (sandbox)

| API | Where |
|---|---|
| OAuth 2.0 client credentials | `src/lib/paypal.ts` |
| Orders v2: create, capture, get | Buyer agent checkout, order lookups |
| Orders v2 tracking (`/v2/checkout/orders/{id}/track`) | Seller uploads tracking (needed for Seller Protection) |
| JavaScript SDK (PayPal Buttons via `@paypal/react-paypal-js`) | Human approves the agent's checkout |
| Disputes v1: list, get, `send-message`, `make-offer`, `provide-evidence`, `accept-claim` | Seller agent and approval actions |
| Disputes v1 sandbox: `require-evidence`, `adjudicate` | Demo controls to walk a dispute through its lifecycle |
| Webhooks: `CUSTOMER.DISPUTE.*` + signature verification | `src/app/api/webhooks/paypal/route.ts` |

## AI used

- **Claude (Anthropic API)**, model `claude-opus-5-5` by default (set `CLAUDE_MODEL` to change it), via the official `@anthropic-ai/sdk`.
- **Seller agent** (`src/lib/agents/seller.ts`): a tool-using agent. Its tools call PayPal (get dispute, order and tracking) and read the listing, the purchase-intent record and shop health. It finishes by filing a structured assessment.
- **Buyer shopping agent** (`src/lib/agents/buyer.ts`): searches the catalog and calls a tool that creates the PayPal order and the purchase-intent record.
- **Negotiation** (`src/lib/agents/negotiation.ts`): seller agent and buyer agent take structured turns (offer, counter, accept, reject) until they agree or give up.
- Guardrails: the agents can read PayPal data and send dispute messages, but every money-moving call (`make-offer`, `provide-evidence`, `accept-claim`) runs only from `/api/disputes/[id]/approve`, triggered by the seller's click. The seller agent cannot offer a refund above `SELLER_MAX_REFUND_PCT` without a return.

## Run it locally

Requirements: Node 20+, a free PayPal Developer account, an Anthropic API key.

1. **PayPal sandbox app.** At [developer.paypal.com](https://developer.paypal.com) → Apps & Credentials → Sandbox → Create App (merchant). Copy the client ID and secret. Under Testing Tools → Sandbox Accounts, note the default **personal (buyer)** account's email and password.
2. **Configure.**
   ```bash
   cp .env.example .env.local
   # fill PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, ANTHROPIC_API_KEY
   npm install
   npm run check   # verifies PayPal Orders/Disputes/Webhooks access and Claude
   ```
3. **Start.**
   ```bash
   npm run dev     # http://localhost:3000
   ```

## Demo walkthrough

1. **Buyer agent** (`/shop`): ask "Buy me a blue hoodie in size M, under $40". The agent picks the item and prepares a PayPal checkout. Pay with the sandbox buyer account.
2. **Seller console** (`/console`): the paid order appears. Click **Ship + upload tracking** (tracking is pushed to PayPal), then **Mark delivered**.
3. **Open a dispute**: on `/shop`, tell your agent what went wrong ("fits like an S"). Then log in to [sandbox.paypal.com](https://www.sandbox.paypal.com) as the sandbox buyer → Resolution Center → report a problem with that payment.
4. **Seller console**: click **Sync with PayPal** (or wait for the webhook / 30-second poll). The seller agent investigates and shows its recommendation, win chance and Seller Protection status in the grid.
5. Click **Negotiate with buyer's agent** to watch the two agents settle, then **Approve settlement**: DisputeShield sends the offer through the PayPal Disputes API.
6. Optional: use **Sandbox controls** to have PayPal adjudicate, and **Submit evidence** for a dispute you want to fight.

### Webhooks (optional)

Locally, the console polls PayPal every 30 seconds. On a public deployment, add a webhook in your PayPal app for `CUSTOMER.DISPUTE.CREATED`, `CUSTOMER.DISPUTE.UPDATED` and `CUSTOMER.DISPUTE.RESOLVED` pointing to `https://<host>/api/webhooks/paypal`, and set `PAYPAL_WEBHOOK_ID`.

## Project layout

```
src/lib/paypal.ts              PayPal REST client (Orders, Tracking, Disputes, Webhooks)
src/lib/agents/seller.ts       Seller agent: investigates and assesses a dispute
src/lib/agents/buyer.ts        Buyer shopping agent: PayPal checkout + purchase intent
src/lib/agents/negotiation.ts  Agent Dispute Protocol negotiation loop
src/lib/disputes.ts            Sync, agent orchestration, approved actions
src/app/console                Seller console (AG Grid)
src/app/shop                   Buyer agent UI with PayPal Buttons
src/app/api                    Route handlers
scripts/check-sandbox.ts       Setup check
```

Data is stored in `data/db.json` (single-seller demo). Run `npm run reset-data` to start over.

## License

MIT, see [LICENSE](LICENSE).
# disputeshield
