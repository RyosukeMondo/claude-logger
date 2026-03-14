import { Pool } from "pg";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL DEFAULT '',
  project_dir TEXT NOT NULL DEFAULT '',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  permission_mode TEXT,
  event_count INTEGER DEFAULT 0,
  prompt_count INTEGER DEFAULT 0,
  tool_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  hook_event_name TEXT NOT NULL,
  tool_name TEXT,
  summary TEXT DEFAULT '',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS shares (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_shares_session ON shares(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_username ON sessions(username);
`;

function defaultUrl(): string {
  return process.env.DATABASE_URL ?? "postgresql://localhost:5432/claude_logger";
}

/** Create a new Pool. */
export function createPool(connectionString?: string): Pool {
  return new Pool({ connectionString: connectionString ?? defaultUrl() });
}

/** Run schema migrations. */
export async function initSchema(pool: Pool): Promise<void> {
  await pool.query(SCHEMA);
}

/**
 * Singleton for Next.js (survives HMR in dev).
 * Automatically runs schema on first call.
 */
const g = globalThis as unknown as {
  __claudeLoggerPool?: Pool;
  __claudeLoggerReady?: boolean;
};

export async function getPool(): Promise<Pool> {
  if (!g.__claudeLoggerPool) {
    g.__claudeLoggerPool = createPool();
  }
  if (!g.__claudeLoggerReady) {
    await initSchema(g.__claudeLoggerPool);
    g.__claudeLoggerReady = true;
  }
  return g.__claudeLoggerPool;
}

/**
 * Extract system username from transcript_path or cwd.
 *   /home/rmondo/.claude/...  → rmondo
 *   /Users/alice/projects/... → alice
 *   C:\Users\mmmhe\...       → mmmhe
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
  const win = p.match(/^[A-Za-z]:\\Users\\([^\\]+)/);
  if (win) return win[1];
  return "unknown";
}
