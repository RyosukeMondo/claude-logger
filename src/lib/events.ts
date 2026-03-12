import type Database from "better-sqlite3";
import type { HookEvent, EventRecord } from "./types";
import { extractUsername } from "./db";
import { buildSummary } from "./summary";

function now(): string {
  return new Date().toISOString();
}

/** Record a hook event. Upserts session, inserts event, returns event ID. */
export function recordEvent(db: Database.Database, event: HookEvent): number {
  const {
    session_id,
    hook_event_name,
    tool_name,
    cwd = "",
    permission_mode,
  } = event;

  const ts = now();
  const summary = buildSummary(event);
  const payload = JSON.stringify(event);
  const username = extractUsername(event);

  const result = db.transaction(() => {
    // Upsert session
    db.prepare(
      `INSERT INTO sessions (id, username, project_dir, started_at, permission_mode)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         username = COALESCE(NULLIF(excluded.username, ''), username),
         project_dir = COALESCE(NULLIF(excluded.project_dir, ''), project_dir),
         permission_mode = COALESCE(excluded.permission_mode, permission_mode)`
    ).run(session_id, username, cwd, ts, permission_mode ?? null);

    // Lifecycle timestamps
    if (hook_event_name === "SessionStart") {
      db.prepare("UPDATE sessions SET started_at = ? WHERE id = ?").run(
        ts,
        session_id
      );
    } else if (hook_event_name === "SessionEnd") {
      db.prepare("UPDATE sessions SET ended_at = ? WHERE id = ?").run(
        ts,
        session_id
      );
    }

    // Insert event
    const info = db
      .prepare(
        `INSERT INTO events (session_id, hook_event_name, tool_name, summary, timestamp, payload)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(session_id, hook_event_name, tool_name ?? null, summary, ts, payload);

    // Bump counters
    db.prepare(
      "UPDATE sessions SET event_count = event_count + 1 WHERE id = ?"
    ).run(session_id);

    if (hook_event_name === "UserPromptSubmit") {
      db.prepare(
        "UPDATE sessions SET prompt_count = prompt_count + 1 WHERE id = ?"
      ).run(session_id);
    }
    if (tool_name) {
      db.prepare(
        "UPDATE sessions SET tool_count = tool_count + 1 WHERE id = ?"
      ).run(session_id);
    }

    return info.lastInsertRowid as number;
  })();

  return result;
}

/** Get events for a session, ordered by timestamp. */
export function getEvents(
  db: Database.Database,
  sessionId: string,
  limit = 500
): EventRecord[] {
  const rows = db
    .prepare(
      `SELECT * FROM events WHERE session_id = ?
       ORDER BY timestamp ASC LIMIT ?`
    )
    .all(sessionId, limit) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: r.id as number,
    session_id: r.session_id as string,
    hook_event_name: r.hook_event_name as string,
    tool_name: (r.tool_name as string) ?? null,
    summary: (r.summary as string) ?? "",
    timestamp: r.timestamp as string,
    payload: JSON.parse(r.payload as string),
  }));
}
