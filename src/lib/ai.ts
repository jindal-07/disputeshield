import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";

let client: Anthropic | null = null;
export function claude() {
  if (!client) client = new Anthropic(); // reads ANTHROPIC_API_KEY
  return client;
}

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/**
 * Shared request settings for every agent call.
 * - effort "medium" keeps the demo snappy; set CLAUDE_EFFORT=high for harder disputes.
 * - Server-side refusal fallbacks are on by default (CLAUDE_FALLBACKS=off to disable).
 */
export function baseParams() {
  const fallbacksOn = process.env.CLAUDE_FALLBACKS !== "off";
  return {
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: (process.env.CLAUDE_EFFORT ?? "medium") as Effort },
    ...(fallbacksOn ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
  };
}
