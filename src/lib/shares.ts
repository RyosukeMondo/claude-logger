import crypto from "crypto";
import type { Pool } from "pg";
import type { Share } from "./types";
import { formatLocal, toLocalIso } from "./time";

/** Create a share link for a session. */
export async function createShare(
  pool: Pool,
  sessionId: string,
  days = 7
): Promise<Share> {
  const id = crypto.randomBytes(6).toString("hex");
  const now = formatLocal(new Date());
  const expires = formatLocal(new Date(
    Date.now() + days * 24 * 60 * 60 * 1000
  ));

  await pool.query(
    "INSERT INTO shares (id, session_id, created_at, expires_at) VALUES ($1, $2, $3, $4)",
    [id, sessionId, now, expires]
  );

  return { id, session_id: sessionId, created_at: now, expires_at: expires };
}

/** Get a share by ID. Returns null if not found or expired. */
export async function getShare(
  pool: Pool,
  shareId: string
): Promise<Share | null> {
  const { rows } = await pool.query(
    "SELECT * FROM shares WHERE id = $1",
    [shareId]
  );

  if (!rows[0]) return null;
  const row = rows[0];
  if (row.expires_at && new Date(row.expires_at) < new Date()) return null;

  return {
    id: row.id,
    session_id: row.session_id,
    created_at: row.created_at ? toLocalIso(row.created_at) : "",
    expires_at: row.expires_at ? toLocalIso(row.expires_at) : null,
  };
}
