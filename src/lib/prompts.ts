import type { Pool } from "pg";
import type { PromptRecord, PromptListResult, PromptFilters } from "./types";
import { toLocalIso } from "./time";
import { calculateCost } from "./costs";

function buildWhere(filters: PromptFilters): { where: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.username) {
    params.push(filters.username);
    conditions.push(`pb.username = $${params.length}`);
  }
  if (filters.project) {
    params.push(filters.project);
    conditions.push(`pb.project_name = $${params.length}`);
  }
  if (filters.dateFrom) {
    params.push(new Date(`${filters.dateFrom}T00:00:00+09:00`));
    conditions.push(`pb.prompt_ts >= $${params.length}`);
  }
  if (filters.dateTo) {
    params.push(new Date(`${filters.dateTo}T23:59:59.999+09:00`));
    conditions.push(`pb.prompt_ts <= $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    conditions.push(
      `(COALESCE(pb.prompt_text, pb.summary) ILIKE $${params.length})`
    );
  }

  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

function toPromptRecord(row: Record<string, unknown>): PromptRecord {
  const inputTokens = Number(row.input_tokens ?? 0);
  const outputTokens = Number(row.output_tokens ?? 0);
  return {
    event_id: row.event_id as number,
    session_id: row.session_id as string,
    username: (row.username as string) ?? "",
    project_name: (row.project_name as string) ?? "",
    prompt_text: (row.prompt_text as string) ?? "",
    timestamp: row.timestamp ? toLocalIso(row.timestamp) : "",
    duration_seconds: row.duration_seconds != null ? Number(row.duration_seconds) : null,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: calculateCost(inputTokens, outputTokens),
    tool_count: Number(row.tool_count ?? 0),
    tool_names: Array.isArray(row.tool_names) ? row.tool_names.filter(Boolean) : [],
  };
}

/** List prompts with per-prompt metrics (duration, tokens, tools, cost). */
export async function listPrompts(
  pool: Pool,
  filters: PromptFilters = {}
): Promise<PromptListResult> {
  const { where, params } = buildWhere(filters);
  const limit = Math.min(filters.limit ?? 50, 200);
  const offset = filters.offset ?? 0;

  const dataParams = [...params, limit, offset];
  const limitP = `$${dataParams.length - 1}`;
  const offsetP = `$${dataParams.length}`;

  const dataSql = `
    WITH prompt_bounds AS (
      SELECT e.id AS event_id, e.session_id, e.timestamp AS prompt_ts,
        e.payload->>'prompt' AS prompt_text, e.summary,
        s.username, s.project_name,
        LEAD(e.timestamp) OVER (PARTITION BY e.session_id ORDER BY e.timestamp) AS next_prompt_ts
      FROM events e
      JOIN sessions s ON s.id = e.session_id
      WHERE e.hook_event_name = 'UserPromptSubmit'
    ),
    prompt_metrics AS (
      SELECT pb.event_id,
        EXTRACT(EPOCH FROM (
          MIN(e2.timestamp) FILTER (WHERE e2.hook_event_name = 'Stop') - pb.prompt_ts
        ))::int AS duration_seconds,
        COALESCE(SUM(CASE WHEN e2.hook_event_name = 'Stop'
          THEN (e2.payload->'usage'->>'input_tokens')::bigint END), 0) AS input_tokens,
        COALESCE(SUM(CASE WHEN e2.hook_event_name = 'Stop'
          THEN (e2.payload->'usage'->>'output_tokens')::bigint END), 0) AS output_tokens,
        COUNT(*) FILTER (WHERE e2.hook_event_name = 'PreToolUse')::int AS tool_count,
        COALESCE(array_agg(DISTINCT e2.tool_name)
          FILTER (WHERE e2.tool_name IS NOT NULL), ARRAY[]::text[]) AS tool_names
      FROM prompt_bounds pb
      LEFT JOIN events e2 ON e2.session_id = pb.session_id
        AND e2.timestamp > pb.prompt_ts
        AND (e2.timestamp < pb.next_prompt_ts OR pb.next_prompt_ts IS NULL)
      GROUP BY pb.event_id, pb.prompt_ts
    )
    SELECT pb.event_id, pb.session_id, pb.username, pb.project_name,
      COALESCE(pb.prompt_text, pb.summary) AS prompt_text,
      pb.prompt_ts AS timestamp, pm.duration_seconds,
      pm.input_tokens, pm.output_tokens, pm.tool_count, pm.tool_names
    FROM prompt_bounds pb
    LEFT JOIN prompt_metrics pm ON pm.event_id = pb.event_id
    ${where}
    ORDER BY pb.prompt_ts DESC
    LIMIT ${limitP} OFFSET ${offsetP}`;

  const countSql = `
    WITH prompt_bounds AS (
      SELECT e.id AS event_id, e.timestamp AS prompt_ts,
        e.payload->>'prompt' AS prompt_text, e.summary,
        s.username, s.project_name
      FROM events e
      JOIN sessions s ON s.id = e.session_id
      WHERE e.hook_event_name = 'UserPromptSubmit'
    )
    SELECT COUNT(*)::int AS total FROM prompt_bounds pb ${where}`;

  const [data, count] = await Promise.all([
    pool.query(dataSql, dataParams),
    pool.query(countSql, params),
  ]);

  return {
    prompts: data.rows.map(toPromptRecord),
    total: count.rows[0]?.total ?? 0,
  };
}
