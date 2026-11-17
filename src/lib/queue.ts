import type { Pool } from "pg";
import type { HookEvent, QueueStatus, HealthStatus } from "./types";
import { recordEvent } from "./events";
import { toLocalIso } from "./time";

const startTime = Date.now();
const MAX_ATTEMPTS = 5;

/** Enqueue a failed event for retry. */
export async function enqueue(
  pool: Pool,
  payload: HookEvent,
  error?: string
): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO event_queue (payload, last_error, next_retry_at)
     VALUES ($1, $2, NOW() + INTERVAL '30 seconds')
     RETURNING id`,
    [JSON.stringify(payload), error ?? null]
  );
  return rows[0].id;
}

/** Process pending items in the queue with exponential backoff. */
export async function processQueue(
  pool: Pool
): Promise<{ processed: number; failed: number }> {
  const { rows } = await pool.query(
    `SELECT id, payload, attempts FROM event_queue
     WHERE attempts < $1 AND next_retry_at <= NOW()
     ORDER BY next_retry_at ASC
     LIMIT 50`,
    [MAX_ATTEMPTS]
  );

  let processed = 0;
  let failed = 0;

  for (const row of rows) {
    const payload = typeof row.payload === "string"
      ? JSON.parse(row.payload)
      : row.payload;
    try {
      await recordEvent(pool, payload as HookEvent);
      await pool.query("DELETE FROM event_queue WHERE id = $1", [row.id]);
      processed++;
    } catch (e) {
      const nextRetrySec = Math.pow(2, row.attempts + 1) * 30; // exponential backoff in seconds
      await pool.query(
        `UPDATE event_queue SET
           attempts = attempts + 1,
           last_error = $1,
           next_retry_at = NOW() + make_interval(secs => $2)
         WHERE id = $3`,
        [String(e), nextRetrySec, row.id]
      );
      failed++;
    }
  }

  return { processed, failed };
}

/** Get queue status. */
export async function getQueueStatus(pool: Pool): Promise<QueueStatus> {
  const pendingRes = await pool.query(
    `SELECT COUNT(*)::int as c FROM event_queue WHERE attempts < $1`,
    [MAX_ATTEMPTS]
  );
  const failedRes = await pool.query(
    `SELECT COUNT(*)::int as c FROM event_queue WHERE attempts >= $1`,
    [MAX_ATTEMPTS]
  );
  const oldestRes = await pool.query(
    `SELECT MIN(created_at) as oldest FROM event_queue WHERE attempts < $1`,
    [MAX_ATTEMPTS]
  );

  return {
    pending: pendingRes.rows[0].c,
    failed: failedRes.rows[0].c,
    oldest_pending: oldestRes.rows[0].oldest
      ? toLocalIso(oldestRes.rows[0].oldest)
      : null,
  };
}

/** Health check: DB connectivity + queue status. */
export async function getHealthStatus(pool: Pool): Promise<HealthStatus> {
  let dbConnected = false;
  let queue: QueueStatus = { pending: 0, failed: 0, oldest_pending: null };

  try {
    await pool.query("SELECT 1");
    dbConnected = true;
    queue = await getQueueStatus(pool);
  } catch {
    // DB is down
  }

  const status = !dbConnected ? "down" : queue.pending > 10 ? "degraded" : "ok";

  return {
    status,
    db: dbConnected ? "connected" : "disconnected",
    queue,
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
  };
}
