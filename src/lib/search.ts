import type { Pool } from "pg";
import type { SearchResult } from "./types";
import { toLocalIso } from "./time";

/** Full-text search across events (summaries, tool names, prompt text in payload). */
export async function searchEvents(
  pool: Pool,
  query: string,
  options: { username?: string; limit?: number; offset?: number } = {}
): Promise<{ results: SearchResult[]; total: number }> {
  const { username, limit = 50, offset = 0 } = options;
  const trimmed = query.trim();
  if (!trimmed) return { results: [], total: 0 };

  // Use ILIKE for short queries, ts_vector for longer ones
  const useFullText = trimmed.length >= 3 && !trimmed.includes("%");

  const conditions: string[] = [];
  const params: unknown[] = [];
  let orderClause: string;

  if (useFullText) {
    params.push(trimmed);
    conditions.push(
      `(to_tsvector('english', COALESCE(e.summary, '') || ' ' || COALESCE(e.tool_name, '')) @@ plainto_tsquery('english', $${params.length})
        OR e.summary ILIKE '%' || $${params.length} || '%'
        OR e.payload->>'prompt' ILIKE '%' || $${params.length} || '%')`
    );
    orderClause = `ts_rank(to_tsvector('english', COALESCE(e.summary, '') || ' ' || COALESCE(e.tool_name, '')), plainto_tsquery('english', $1)) DESC, e.timestamp DESC`;
  } else {
    params.push(`%${trimmed}%`);
    conditions.push(
      `(e.summary ILIKE $${params.length}
        OR e.tool_name ILIKE $${params.length}
        OR e.payload->>'prompt' ILIKE $${params.length})`
    );
    orderClause = "e.timestamp DESC";
  }

  if (username) {
    params.push(username);
    conditions.push(`s.username = $${params.length}`);
  }

  const where = conditions.join(" AND ");

  // Count total
  const countResult = await pool.query(
    `SELECT COUNT(*)::int as total FROM events e
     JOIN sessions s ON s.id = e.session_id
     WHERE ${where}`,
    params
  );

  // Fetch results
  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT e.*, s.username as session_username, s.project_name as session_project
     FROM events e
     JOIN sessions s ON s.id = e.session_id
     WHERE ${where}
     ORDER BY ${orderClause}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    total: countResult.rows[0].total,
    results: rows.map((r, i) => ({
      event: {
        id: r.id,
        session_id: r.session_id,
        hook_event_name: r.hook_event_name,
        tool_name: r.tool_name ?? null,
        summary: r.summary ?? "",
        timestamp: r.timestamp ? toLocalIso(r.timestamp) : "",
        payload: typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload,
      },
      session_username: r.session_username,
      session_project: r.session_project,
      rank: i,
    })),
  };
}
