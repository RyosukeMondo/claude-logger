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

/** List sessions, most recent first. Optionally filter by username. */
export async function listSessions(
  pool: Pool,
  limit = 50,
  offset = 0,
  username?: string
): Promise<Session[]> {
  if (username) {
    const { rows } = await pool.query(
      `SELECT * FROM sessions WHERE username = $1
       ORDER BY COALESCE(started_at, '9999-01-01') DESC
       LIMIT $2 OFFSET $3`,
      [username, limit, offset]
    );
    return rows.map(toSession);
  }
  const { rows } = await pool.query(
    `SELECT * FROM sessions
     ORDER BY COALESCE(started_at, '9999-01-01') DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
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
    `SELECT COUNT(*)::int as c FROM sessions ${userSessionFilter}`,
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

  return {
    total_sessions: sessRes.rows[0].c,
    total_events: evtRes.rows[0].c,
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
    started_at: r.started_at ? toLocalIso(r.started_at) : null,
    ended_at: r.ended_at ? toLocalIso(r.ended_at) : null,
    permission_mode: (r.permission_mode as string) ?? null,
    event_count: (r.event_count as number) ?? 0,
    prompt_count: (r.prompt_count as number) ?? 0,
    tool_count: (r.tool_count as number) ?? 0,
  };
}

