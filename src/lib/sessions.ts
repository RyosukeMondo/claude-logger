import type { Pool } from "pg";
import type { Session, Stats } from "./types";
import { toLocalIso } from "./time";

/** List distinct usernames. */
export async function listUsers(pool: Pool): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT DISTINCT username FROM sessions
     WHERE username != '' ORDER BY username`
  );
  return rows.map((r) => r.username);
}

/** List sessions, most recent first. Optionally filter by username and/or project. */
export async function listSessions(
  pool: Pool,
  limit = 50,
  offset = 0,
  username?: string,
  project?: string
): Promise<Session[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (username) {
    params.push(username);
    conditions.push(`username = $${params.length}`);
  }
  if (project) {
    params.push(project);
    conditions.push(`project_name = $${params.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT * FROM sessions ${where}
     ORDER BY COALESCE(started_at, '9999-01-01') DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows.map(toSession);
}

/** Get a single session by ID. */
export async function getSession(
  pool: Pool,
  sessionId: string
): Promise<Session | null> {
  const { rows } = await pool.query(
    "SELECT * FROM sessions WHERE id = $1",
    [sessionId]
  );
  return rows[0] ? toSession(rows[0]) : null;
}

/** Count sessions. Optionally filter by username and/or project. */
export async function countSessions(
  pool: Pool,
  username?: string,
  project?: string
): Promise<number> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (username) {
    params.push(username);
    conditions.push(`username = $${params.length}`);
  }
  if (project) {
    params.push(project);
    conditions.push(`project_name = $${params.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int as c FROM sessions ${where}`,
    params
  );
  return rows[0].c;
}

/** Aggregate stats. Optionally filter by username. */
export async function getStats(pool: Pool, username?: string): Promise<Stats> {
  const userSessionFilter = username
    ? "WHERE username = $1"
    : "";
  const eventJoin = username
    ? "WHERE e.session_id IN (SELECT id FROM sessions WHERE username = $1)"
    : "";
  const eventToolFilter = username
    ? "WHERE e.session_id IN (SELECT id FROM sessions WHERE username = $1) AND e.tool_name IS NOT NULL"
    : "WHERE e.tool_name IS NOT NULL";
  const params = username ? [username] : [];

  const sessRes = await pool.query(
    `SELECT COUNT(*)::int as c,
            COALESCE(SUM(total_input_tokens), 0)::bigint as input_tokens,
            COALESCE(SUM(total_output_tokens), 0)::bigint as output_tokens,
            COALESCE(SUM(total_cost_usd), 0)::numeric as cost
     FROM sessions ${userSessionFilter}`,
    params
  );
  const evtRes = await pool.query(
    `SELECT COUNT(*)::int as c FROM events e ${eventJoin}`,
    params
  );
  const toolRes = await pool.query(
    `SELECT e.tool_name, COUNT(*)::int as count FROM events e
     ${eventToolFilter}
     GROUP BY e.tool_name ORDER BY count DESC LIMIT 20`,
    params
  );
  const recentRes = await pool.query(
    `SELECT e.session_id, e.hook_event_name, e.tool_name, e.summary, e.timestamp
     FROM events e ${eventJoin}
     ORDER BY e.timestamp DESC LIMIT 15`,
    params
  );

  const row = sessRes.rows[0];
  return {
    total_sessions: row.c,
    total_events: evtRes.rows[0].c,
    total_input_tokens: Number(row.input_tokens),
    total_output_tokens: Number(row.output_tokens),
    total_cost_usd: Number(row.cost),
    tool_usage: toolRes.rows.map((r) => ({ name: r.tool_name, count: r.count })),
    recent_activity: recentRes.rows.map((r) => ({
      ...r,
      timestamp: r.timestamp ? toLocalIso(r.timestamp) : "",
    })),
  };
}

function toSession(r: Record<string, unknown>): Session {
  return {
    id: r.id as string,
    username: (r.username as string) ?? "",
    project_dir: (r.project_dir as string) ?? "",
    project_name: (r.project_name as string) ?? "",
    started_at: r.started_at ? toLocalIso(r.started_at) : null,
    ended_at: r.ended_at ? toLocalIso(r.ended_at) : null,
    permission_mode: (r.permission_mode as string) ?? null,
    event_count: (r.event_count as number) ?? 0,
    prompt_count: (r.prompt_count as number) ?? 0,
    tool_count: (r.tool_count as number) ?? 0,
    total_input_tokens: Number(r.total_input_tokens ?? 0),
    total_output_tokens: Number(r.total_output_tokens ?? 0),
    total_cost_usd: Number(r.total_cost_usd ?? 0),
  };
}

