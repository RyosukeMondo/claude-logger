import type { Pool } from "pg";
import type { DailyTrend, ToolTrend, HeatmapCell } from "./types";

/** Get daily trends for the last N days. */
export async function getDailyTrends(
  pool: Pool,
  options: { username?: string; days?: number } = {}
): Promise<DailyTrend[]> {
  const { username, days = 30 } = options;
  const safeDays = Math.max(1, Math.floor(Number(days)));
  const params: unknown[] = [safeDays];
  const conditions: string[] = [`s.started_at >= NOW() - make_interval(days => $1)`];

  if (username) {
    params.push(username);
    conditions.push(`s.username = $${params.length}`);
  }

  const where = conditions.join(" AND ");

  const { rows } = await pool.query(
    `SELECT
       date_trunc('day', e.timestamp AT TIME ZONE 'Asia/Tokyo')::date as date,
       COUNT(DISTINCT e.session_id)::int as sessions,
       COUNT(*)::int as events,
       COUNT(*) FILTER (WHERE e.hook_event_name = 'UserPromptSubmit')::int as prompts,
       COUNT(*) FILTER (WHERE e.tool_name IS NOT NULL)::int as tools,
       COALESCE(SUM(CASE WHEN e.hook_event_name = 'Stop'
         THEN (e.payload->>'usage')::jsonb->>'input_tokens' ELSE NULL END)::bigint, 0) as input_tokens,
       COALESCE(SUM(CASE WHEN e.hook_event_name = 'Stop'
         THEN (e.payload->>'usage')::jsonb->>'output_tokens' ELSE NULL END)::bigint, 0) as output_tokens,
       0 as cost_usd
     FROM events e
     JOIN sessions s ON s.id = e.session_id
     WHERE ${where}
     GROUP BY date
     ORDER BY date ASC`,
    params
  );

  return rows.map((r) => ({
    date: String(r.date).slice(0, 10),
    sessions: r.sessions,
    events: r.events,
    prompts: r.prompts,
    tools: r.tools,
    input_tokens: Number(r.input_tokens),
    output_tokens: Number(r.output_tokens),
    cost_usd: Number(r.cost_usd),
  }));
}

/** Get tool usage trends grouped by day. */
export async function getToolTrends(
  pool: Pool,
  options: { username?: string; days?: number } = {}
): Promise<ToolTrend[]> {
  const { username, days = 30 } = options;
  const safeDays = Math.max(1, Math.floor(Number(days)));
  const params: unknown[] = [safeDays];
  const conditions: string[] = [
    `e.tool_name IS NOT NULL`,
    `e.timestamp >= NOW() - make_interval(days => $1)`,
  ];

  if (username) {
    params.push(username);
    conditions.push(`e.session_id IN (SELECT id FROM sessions WHERE username = $${params.length})`);
  }

  const where = conditions.join(" AND ");

  const { rows } = await pool.query(
    `SELECT
       date_trunc('day', e.timestamp AT TIME ZONE 'Asia/Tokyo')::date as date,
       e.tool_name,
       COUNT(*)::int as count
     FROM events e
     WHERE ${where}
     GROUP BY date, e.tool_name
     ORDER BY date ASC, count DESC`,
    params
  );

  return rows.map((r) => ({
    date: String(r.date).slice(0, 10),
    tool_name: r.tool_name,
    count: r.count,
  }));
}

/** Get activity heatmap: hour-of-day x day-of-week. */
export async function getActiveHoursHeatmap(
  pool: Pool,
  options: { username?: string; days?: number } = {}
): Promise<HeatmapCell[]> {
  const { username, days = 90 } = options;
  const safeDays = Math.max(1, Math.floor(Number(days)));
  const params: unknown[] = [safeDays];
  const conditions: string[] = [`e.timestamp >= NOW() - make_interval(days => $1)`];

  if (username) {
    params.push(username);
    conditions.push(`e.session_id IN (SELECT id FROM sessions WHERE username = $${params.length})`);
  }

  const where = conditions.join(" AND ");

  const { rows } = await pool.query(
    `SELECT
       EXTRACT(DOW FROM e.timestamp AT TIME ZONE 'Asia/Tokyo')::int as day_of_week,
       EXTRACT(HOUR FROM e.timestamp AT TIME ZONE 'Asia/Tokyo')::int as hour,
       COUNT(*)::int as count
     FROM events e
     WHERE ${where}
     GROUP BY day_of_week, hour
     ORDER BY day_of_week, hour`,
    params
  );

  return rows.map((r) => ({
    day_of_week: r.day_of_week,
    hour: r.hour,
    count: r.count,
  }));
}
