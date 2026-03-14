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

/** Delete an event by ID. Decrements session counters. */
export async function deleteEvent(pool: Pool, eventId: number): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      "DELETE FROM events WHERE id = $1 RETURNING session_id, hook_event_name, tool_name",
      [eventId]
    );
    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return false;
    }

    const { session_id, hook_event_name, tool_name } = rows[0];

    await client.query(
      "UPDATE sessions SET event_count = GREATEST(event_count - 1, 0) WHERE id = $1",
      [session_id]
    );
    if (hook_event_name === "UserPromptSubmit") {
      await client.query(
        "UPDATE sessions SET prompt_count = GREATEST(prompt_count - 1, 0) WHERE id = $1",
        [session_id]
      );
    }
    if (tool_name) {
      await client.query(
        "UPDATE sessions SET tool_count = GREATEST(tool_count - 1, 0) WHERE id = $1",
        [session_id]
      );
    }

    await client.query("COMMIT");
    return true;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/** Get UserPromptSubmit timestamps grouped by session. Optionally filter by date. */
export async function getPromptTimestamps(
  pool: Pool,
  sessionIds: string[],
  date?: string // YYYY-MM-DD, filters to that day
): Promise<Map<string, number[]>> {
  if (sessionIds.length === 0) return new Map();

  let query: string;
  let params: unknown[];

  if (date) {
    // Convert date string to explicit JST boundaries as ISO timestamps
    // so PostgreSQL (UTC) gets the correct range
    const dayStartJST = `${date}T00:00:00+09:00`;
    const dayEndJST = `${date}T23:59:59.999+09:00`;
    query = `SELECT session_id, timestamp FROM events
     WHERE session_id = ANY($1) AND hook_event_name = 'UserPromptSubmit'
       AND timestamp >= $2::timestamptz AND timestamp <= $3::timestamptz
     ORDER BY timestamp ASC`;
    params = [sessionIds, dayStartJST, dayEndJST];
  } else {
    query = `SELECT session_id, timestamp FROM events
     WHERE session_id = ANY($1) AND hook_event_name = 'UserPromptSubmit'
     ORDER BY timestamp ASC`;
    params = [sessionIds];
  }

  const { rows } = await pool.query(query, params);

  const map = new Map<string, number[]>();
  for (const r of rows) {
    const ts = r.timestamp instanceof Date
      ? r.timestamp.getTime()
      : new Date(r.timestamp).getTime();
    const arr = map.get(r.session_id) ?? [];
    arr.push(ts);
    map.set(r.session_id, arr);
  }
  return map;
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
