import type { Pool } from "pg";
import type { HookEvent, EventRecord } from "./types";
import { extractUsername } from "./db";
import { buildSummary } from "./summary";
import { toLocalIso } from "./time";

/** Record a hook event. Upserts session, inserts event, returns event ID. */
export async function recordEvent(pool: Pool, event: HookEvent): Promise<number> {
  const {
    session_id,
    hook_event_name,
    tool_name,
    cwd = "",
    permission_mode,
  } = event;

  const ts = new Date().toISOString();
  const summary = buildSummary(event);
  const username = extractUsername(event);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO sessions (id, username, project_dir, started_at, permission_mode)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT(id) DO UPDATE SET
         username = COALESCE(NULLIF(EXCLUDED.username, ''), sessions.username),
         project_dir = COALESCE(NULLIF(EXCLUDED.project_dir, ''), sessions.project_dir),
         permission_mode = COALESCE(EXCLUDED.permission_mode, sessions.permission_mode)`,
      [session_id, username, cwd, ts, permission_mode ?? null]
    );

    if (hook_event_name === "SessionStart") {
      await client.query(
        "UPDATE sessions SET started_at = $1 WHERE id = $2",
        [ts, session_id]
      );
    } else if (hook_event_name === "SessionEnd") {
      await client.query(
        "UPDATE sessions SET ended_at = $1 WHERE id = $2",
        [ts, session_id]
      );
    }

    const result = await client.query(
      `INSERT INTO events (session_id, hook_event_name, tool_name, summary, timestamp, payload)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [session_id, hook_event_name, tool_name ?? null, summary, ts, JSON.stringify(event)]
    );
    const eventId = result.rows[0].id;

    await client.query(
      "UPDATE sessions SET event_count = event_count + 1 WHERE id = $1",
      [session_id]
    );

    if (hook_event_name === "UserPromptSubmit") {
      await client.query(
        "UPDATE sessions SET prompt_count = prompt_count + 1 WHERE id = $1",
        [session_id]
      );
    }
    if (tool_name) {
      await client.query(
        "UPDATE sessions SET tool_count = tool_count + 1 WHERE id = $1",
        [session_id]
      );
    }

    await client.query("COMMIT");
    return eventId;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/** Get events for a session, ordered by timestamp. */
export async function getEvents(
  pool: Pool,
  sessionId: string,
  limit = 500
): Promise<EventRecord[]> {
  const { rows } = await pool.query(
    `SELECT * FROM events WHERE session_id = $1
     ORDER BY timestamp ASC LIMIT $2`,
    [sessionId, limit]
  );

  return rows.map((r) => ({
    id: r.id,
    session_id: r.session_id,
    hook_event_name: r.hook_event_name,
    tool_name: r.tool_name ?? null,
    summary: r.summary ?? "",
    timestamp: r.timestamp ? toLocalIso(r.timestamp) : "",
    payload: typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload,
  }));
}
