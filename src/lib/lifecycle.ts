import type { Pool } from "pg";
import type { RetentionConfig, PruneResult } from "./types";
import { toLocalIso } from "./time";

/** Export sessions as JSON (with events). */
export async function exportSessionsJson(
  pool: Pool,
  options: { username?: string; since?: string; until?: string } = {}
): Promise<object[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.username) {
    params.push(options.username);
    conditions.push(`s.username = $${params.length}`);
  }
  if (options.since) {
    params.push(options.since);
    conditions.push(`s.started_at >= $${params.length}`);
  }
  if (options.until) {
    params.push(options.until);
    conditions.push(`s.started_at <= $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows: sessions } = await pool.query(
    `SELECT * FROM sessions s ${where} ORDER BY started_at DESC`,
    params
  );

  const result = [];
  for (const s of sessions) {
    const { rows: events } = await pool.query(
      `SELECT * FROM events WHERE session_id = $1 ORDER BY timestamp ASC`,
      [s.id]
    );
    result.push({
      ...s,
      events: events.map((e) => ({
        ...e,
        payload: typeof e.payload === "string" ? JSON.parse(e.payload) : e.payload,
      })),
    });
  }
  return result;
}

/** Export sessions as CSV. */
export async function exportSessionsCsv(
  pool: Pool,
  options: { username?: string; since?: string; until?: string } = {}
): Promise<string> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.username) {
    params.push(options.username);
    conditions.push(`username = $${params.length}`);
  }
  if (options.since) {
    params.push(options.since);
    conditions.push(`started_at >= $${params.length}`);
  }
  if (options.until) {
    params.push(options.until);
    conditions.push(`started_at <= $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows } = await pool.query(
    `SELECT id, username, project_dir, project_name, started_at, ended_at,
            permission_mode, event_count, prompt_count, tool_count,
            total_input_tokens, total_output_tokens, total_cost_usd
     FROM sessions ${where} ORDER BY started_at DESC`,
    params
  );

  const headers = [
    "id", "username", "project_dir", "project_name", "started_at", "ended_at",
    "permission_mode", "event_count", "prompt_count", "tool_count",
    "total_input_tokens", "total_output_tokens", "total_cost_usd",
  ];

  const csvRows = [headers.join(",")];
  for (const r of rows) {
    csvRows.push(
      headers
        .map((h) => {
          const val = r[h];
          if (val === null || val === undefined) return "";
          const s = String(val);
          return s.includes(",") || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        })
        .join(",")
    );
  }
  return csvRows.join("\n");
}

/** Bulk delete sessions and their events/shares. */
export async function bulkDeleteSessions(
  pool: Pool,
  sessionIds: string[]
): Promise<number> {
  if (sessionIds.length === 0) return 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM shares WHERE session_id = ANY($1)", [sessionIds]);
    await client.query("DELETE FROM events WHERE session_id = ANY($1)", [sessionIds]);
    const { rowCount } = await client.query("DELETE FROM sessions WHERE id = ANY($1)", [sessionIds]);
    await client.query("COMMIT");
    return rowCount ?? 0;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/** Prune old data beyond retention period. */
export async function pruneOldData(
  pool: Pool,
  maxAgeDays: number
): Promise<PruneResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const cutoff = new Date(Date.now() - maxAgeDays * 24 * 3600 * 1000).toISOString();

    const sharesRes = await client.query(
      `DELETE FROM shares WHERE session_id IN
         (SELECT id FROM sessions WHERE started_at < $1)`,
      [cutoff]
    );
    const eventsRes = await client.query(
      `DELETE FROM events WHERE session_id IN
         (SELECT id FROM sessions WHERE started_at < $1)`,
      [cutoff]
    );
    const sessionsRes = await client.query(
      "DELETE FROM sessions WHERE started_at < $1",
      [cutoff]
    );

    await client.query("COMMIT");
    return {
      sessions_deleted: sessionsRes.rowCount ?? 0,
      events_deleted: eventsRes.rowCount ?? 0,
      shares_deleted: sharesRes.rowCount ?? 0,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/** Delete expired shares. */
export async function cleanupExpiredShares(pool: Pool): Promise<number> {
  const { rowCount } = await pool.query(
    "DELETE FROM shares WHERE expires_at IS NOT NULL AND expires_at < NOW()"
  );
  return rowCount ?? 0;
}

/** Get retention config (creates default if missing). */
export async function getRetentionConfig(pool: Pool): Promise<RetentionConfig> {
  await pool.query(
    `INSERT INTO retention_config (id, max_age_days, auto_prune_enabled)
     VALUES (1, 90, false)
     ON CONFLICT (id) DO NOTHING`
  );
  const { rows } = await pool.query("SELECT * FROM retention_config WHERE id = 1");
  const r = rows[0];
  return {
    max_age_days: r.max_age_days,
    auto_prune_enabled: r.auto_prune_enabled,
    last_pruned_at: r.last_pruned_at ? toLocalIso(r.last_pruned_at) : null,
  };
}

/** Update retention config. */
export async function updateRetentionConfig(
  pool: Pool,
  config: Partial<RetentionConfig>
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (config.max_age_days !== undefined) {
    params.push(config.max_age_days);
    sets.push(`max_age_days = $${params.length}`);
  }
  if (config.auto_prune_enabled !== undefined) {
    params.push(config.auto_prune_enabled);
    sets.push(`auto_prune_enabled = $${params.length}`);
  }

  if (sets.length === 0) return;

  await pool.query(
    `INSERT INTO retention_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING`
  );
  await pool.query(
    `UPDATE retention_config SET ${sets.join(", ")} WHERE id = 1`,
    params
  );
}
