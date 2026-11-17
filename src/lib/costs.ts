import type { Pool } from "pg";
import type { HookEvent, CostSummary, AggregateCosts } from "./types";
import { toLocalIso } from "./time";

// Pricing per million tokens (USD) — default to Sonnet 4 pricing
const PRICING: Record<string, { input: number; output: number }> = {
  default: { input: 3.0, output: 15.0 },
  "claude-sonnet-4-20250514": { input: 3.0, output: 15.0 },
  "claude-opus-4-20250514": { input: 15.0, output: 75.0 },
  "claude-haiku-3-5-20241022": { input: 0.8, output: 4.0 },
};

/** Extract token usage from a hook event payload. */
export function extractTokenUsage(event: HookEvent): {
  input_tokens: number;
  output_tokens: number;
} {
  // Check top-level usage field
  const usage = event.usage as
    | { input_tokens?: number; output_tokens?: number }
    | undefined;
  if (usage?.input_tokens || usage?.output_tokens) {
    return {
      input_tokens: usage.input_tokens ?? 0,
      output_tokens: usage.output_tokens ?? 0,
    };
  }

  // Check nested in result
  const result = event.result as Record<string, unknown> | undefined;
  if (result?.usage) {
    const u = result.usage as { input_tokens?: number; output_tokens?: number };
    return {
      input_tokens: u.input_tokens ?? 0,
      output_tokens: u.output_tokens ?? 0,
    };
  }

  return { input_tokens: 0, output_tokens: 0 };
}

/** Calculate estimated cost in USD from token counts. */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model?: string
): number {
  const pricing = PRICING[model ?? ""] ?? PRICING.default;
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}

/** Get aggregate costs, optionally filtered by user or date. */
export async function getAggregateCosts(
  pool: Pool,
  options: { username?: string; since?: string } = {}
): Promise<AggregateCosts> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.username) {
    params.push(options.username);
    conditions.push(`username = $${params.length}`);
  }
  if (options.since) {
    params.push(options.since);
    conditions.push(`started_at >= $${params.length}`);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const totalRes = await pool.query(
    `SELECT
       COALESCE(SUM(total_input_tokens), 0)::bigint as input_tokens,
       COALESCE(SUM(total_output_tokens), 0)::bigint as output_tokens,
       COALESCE(SUM(total_cost_usd), 0)::numeric as cost
     FROM sessions ${where}`,
    params
  );

  const bySessionRes = await pool.query(
    `SELECT id, username, total_input_tokens, total_output_tokens, total_cost_usd
     FROM sessions ${where}
     ORDER BY total_cost_usd DESC LIMIT 50`,
    params
  );

  const t = totalRes.rows[0];
  const inputTokens = Number(t.input_tokens);
  const outputTokens = Number(t.output_tokens);

  return {
    total: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
      estimated_cost_usd: Number(t.cost),
    },
    by_session: bySessionRes.rows.map((r) => ({
      session_id: r.id,
      username: r.username,
      cost: {
        input_tokens: Number(r.total_input_tokens),
        output_tokens: Number(r.total_output_tokens),
        total_tokens:
          Number(r.total_input_tokens) + Number(r.total_output_tokens),
        estimated_cost_usd: Number(r.total_cost_usd),
      },
    })),
  };
}
