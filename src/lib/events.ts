import type { Pool } from "pg";
import type { HookEvent, EventRecord } from "./types";
import { extractUsername, extractProjectName } from "./db";
import { buildSummary } from "./summary";
import { toLocalIso } from "./time";
import { extractTokenUsage, calculateCost } from "./costs";

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
  const projectName = extractProjectName(cwd);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO sessions (id, username, project_dir, project_name, started_at, permission_mode)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT(id) DO UPDATE SET
         username = COALESCE(NULLIF(EXCLUDED.username, ''), sessions.username),
         project_dir = COALESCE(NULLIF(EXCLUDED.project_dir, ''), sessions.project_dir),
         project_name = COALESCE(NULLIF(EXCLUDED.project_name, ''), sessions.project_name),
         permission_mode = COALESCE(EXCLUDED.permission_mode, sessions.permission_mode)`,
      [session_id, username, cwd, projectName, ts, permission_mode ?? null]
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

    // Extract token usage from Stop events for cost tracking
    if (hook_event_name === "Stop") {
      const tokens = extractTokenUsage(event);
      if (tokens.input_tokens > 0 || tokens.output_tokens > 0) {
        const cost = calculateCost(tokens.input_tokens, tokens.output_tokens);
        await client.query(
          `UPDATE sessions SET
             total_input_tokens = total_input_tokens + $1,
             total_output_tokens = total_output_tokens + $2,
             total_cost_usd = total_cost_usd + $3
           WHERE id = $4`,
          [tokens.input_tokens, tokens.output_tokens, cost, session_id]
        );
      }
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

/** Get UserPromptSubmit timestamps and text grouped by session. */
export async function getPromptTimestamps(
  pool: Pool,
  sessionIds: string[],
  date?: string // YYYY-MM-DD, filters to that day
): Promise<Map<string, { ts: number; text: string }[]>> {
  if (sessionIds.length === 0) return new Map();

  let query: string;
  let params: unknown[];

  if (date) {
    const dayStart = new Date(`${date}T00:00:00+09:00`);
    const dayEnd = new Date(`${date}T23:59:59.999+09:00`);
    query = `SELECT session_id, timestamp, payload->>'prompt' as prompt_text, summary
     FROM events
     WHERE session_id = ANY($1) AND hook_event_name = 'UserPromptSubmit'
       AND timestamp >= $2 AND timestamp <= $3
     ORDER BY timestamp ASC`;
    params = [sessionIds, dayStart, dayEnd];
  } else {
    query = `SELECT session_id, timestamp, payload->>'prompt' as prompt_text, summary
     FROM events
     WHERE session_id = ANY($1) AND hook_event_name = 'UserPromptSubmit'
     ORDER BY timestamp ASC`;
    params = [sessionIds];
  }

  const { rows } = await pool.query(query, params);

  const map = new Map<string, { ts: number; text: string }[]>();
  for (const r of rows) {
    const ts = r.timestamp instanceof Date
      ? r.timestamp.getTime()
      : new Date(r.timestamp).getTime();
    const text = ((r.prompt_text ?? r.summary ?? "") as string).slice(0, 100);
    const arr = map.get(r.session_id) ?? [];
    arr.push({ ts, text });
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
