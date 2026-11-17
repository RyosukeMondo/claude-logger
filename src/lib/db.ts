import { Pool } from "pg";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL DEFAULT '',
  project_dir TEXT NOT NULL DEFAULT '',
  project_name TEXT NOT NULL DEFAULT '',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  permission_mode TEXT,
  event_count INTEGER DEFAULT 0,
  prompt_count INTEGER DEFAULT 0,
  tool_count INTEGER DEFAULT 0,
  total_input_tokens BIGINT DEFAULT 0,
  total_output_tokens BIGINT DEFAULT 0,
  total_cost_usd NUMERIC(10,6) DEFAULT 0
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

CREATE TABLE IF NOT EXISTS api_keys (
  id SERIAL PRIMARY KEY,
  key_hash TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  label TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS retention_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  max_age_days INTEGER DEFAULT 90,
  auto_prune_enabled BOOLEAN DEFAULT false,
  last_pruned_at TIMESTAMPTZ,
  CONSTRAINT single_row CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS event_queue (
  id SERIAL PRIMARY KEY,
  payload JSONB NOT NULL,
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_shares_session ON shares(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_username ON sessions(username);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_name);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_event_queue_retry ON event_queue(next_retry_at);
`;

const MIGRATIONS = `
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS project_name TEXT NOT NULL DEFAULT '';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS total_input_tokens BIGINT DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS total_output_tokens BIGINT DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS total_cost_usd NUMERIC(10,6) DEFAULT 0;
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
  // Run additive migrations for existing databases
  await pool.query(MIGRATIONS);
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

/**
 * Extract a project name from a directory path.
 *   /home/user/repos/my-app → my-app
 *   /tmp → tmp
 */
export function extractProjectName(dir: string): string {
  if (!dir) return "";
  const normalized = dir.replace(/\\/g, "/").replace(/\/+$/, "");
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}
