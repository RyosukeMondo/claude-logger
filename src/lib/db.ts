import Database from "better-sqlite3";
import fs from "fs";
import os from "os";
import path from "path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL DEFAULT '',
  project_dir TEXT NOT NULL DEFAULT '',
  started_at TEXT,
  ended_at TEXT,
  permission_mode TEXT,
  event_count INTEGER DEFAULT 0,
  prompt_count INTEGER DEFAULT 0,
  tool_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  hook_event_name TEXT NOT NULL,
  tool_name TEXT,
  summary TEXT DEFAULT '',
  timestamp TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS shares (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_shares_session ON shares(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_username ON sessions(username);
`;

const MIGRATIONS = [
  `ALTER TABLE sessions ADD COLUMN username TEXT NOT NULL DEFAULT ''`,
];


function defaultDbPath(): string {
  return (
    process.env.CLAUDE_LOGGER_DB ??
    path.join(os.homedir(), ".claude-logger", "events.db")
  );
}

/** Open (or create) the database and return the connection. */
export function openDb(dbPath?: string): Database.Database {
  const p = dbPath ?? defaultDbPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const db = new Database(p);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  db.exec(SCHEMA);
  return db;
}

function runMigrations(db: Database.Database): void {
  for (const sql of MIGRATIONS) {
    try {
      db.exec(sql);
    } catch {
      // column already exists or migration already applied
    }
  }
}

/**
 * Extract system username from transcript_path or cwd.
 *   /home/rmondo/.claude/...  → rmondo
 *   /Users/alice/projects/... → alice
 */
export function extractUsername(event: {
  transcript_path?: string;
  cwd?: string;
}): string {
  const p = event.transcript_path || event.cwd || "";
  const linux = p.match(/^\/home\/([^/]+)/);
  if (linux) return linux[1];
  const mac = p.match(/^\/Users\/([^/]+)/);
  if (mac) return mac[1];
  return "unknown";
}

/**
 * Singleton for Next.js (survives HMR in dev).
 * Call getDb() in API routes and server components.
 * Always runs migrations to handle schema changes without restart.
 */
const g = globalThis as unknown as { __claudeLoggerDb?: Database.Database };

export function getDb(): Database.Database {
  if (!g.__claudeLoggerDb) {
    g.__claudeLoggerDb = openDb();
  } else {
    // Re-run migrations on cached connection to pick up schema changes
    runMigrations(g.__claudeLoggerDb);
  }
  return g.__claudeLoggerDb;
}
