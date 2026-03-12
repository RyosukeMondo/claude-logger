import type Database from "better-sqlite3";
import type { Session, Stats } from "./types";

/** List distinct usernames. */
export function listUsers(db: Database.Database): string[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT username FROM sessions
       WHERE username != '' ORDER BY username`
    )
    .all() as { username: string }[];
  return rows.map((r) => r.username);
}

/** List sessions, most recent first. Optionally filter by username. */
export function listSessions(
  db: Database.Database,
  limit = 50,
  offset = 0,
  username?: string
): Session[] {
  if (username) {
    return db
      .prepare(
        `SELECT * FROM sessions WHERE username = ?
         ORDER BY COALESCE(started_at, '9999') DESC
         LIMIT ? OFFSET ?`
      )
      .all(username, limit, offset) as Session[];
  }
  return db
    .prepare(
      `SELECT * FROM sessions
       ORDER BY COALESCE(started_at, '9999') DESC
       LIMIT ? OFFSET ?`
    )
    .all(limit, offset) as Session[];
}

/** Get a single session by ID. Returns null if not found. */
export function getSession(
  db: Database.Database,
  sessionId: string
): Session | null {
  const row = db
    .prepare("SELECT * FROM sessions WHERE id = ?")
    .get(sessionId) as Session | undefined;
  return row ?? null;
}

/** Aggregate stats across all sessions. Optionally filter by username. */
export function getStats(db: Database.Database, username?: string): Stats {
  const userFilter = username ? "WHERE s.username = ?" : "";
  const eventFilter = username
    ? "WHERE e.session_id IN (SELECT id FROM sessions WHERE username = ?)"
    : "";
  const params = username ? [username] : [];

  const totalSessions = (
    db
      .prepare(`SELECT COUNT(*) as c FROM sessions s ${userFilter}`)
      .get(...params) as { c: number }
  ).c;

  const totalEvents = (
    db
      .prepare(`SELECT COUNT(*) as c FROM events e ${eventFilter}`)
      .get(...params) as { c: number }
  ).c;

  const toolRows = db
    .prepare(
      `SELECT e.tool_name, COUNT(*) as count FROM events e
       ${eventFilter ? eventFilter + " AND" : "WHERE"} e.tool_name IS NOT NULL
       GROUP BY e.tool_name ORDER BY count DESC LIMIT 20`
    )
    .all(...params) as { tool_name: string; count: number }[];

  const recentRows = db
    .prepare(
      `SELECT e.session_id, e.hook_event_name, e.tool_name, e.summary, e.timestamp
       FROM events e ${eventFilter}
       ORDER BY e.timestamp DESC LIMIT 15`
    )
    .all(...params) as {
    session_id: string;
    hook_event_name: string;
    tool_name: string | null;
    summary: string;
    timestamp: string;
  }[];

  return {
    total_sessions: totalSessions,
    total_events: totalEvents,
    tool_usage: toolRows.map((r) => ({ name: r.tool_name, count: r.count })),
    recent_activity: recentRows,
  };
}
