import crypto from "crypto";
import type Database from "better-sqlite3";
import type { Share } from "./types";

/** Create a share link for a session. Returns share info. */
export function createShare(
  db: Database.Database,
  sessionId: string,
  days = 7
): Share {
  const id = crypto.randomBytes(6).toString("hex");
  const now = new Date().toISOString();
  const expires = new Date(
    Date.now() + days * 24 * 60 * 60 * 1000
  ).toISOString();

  db.prepare(
    "INSERT INTO shares (id, session_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
  ).run(id, sessionId, now, expires);

  return { id, session_id: sessionId, created_at: now, expires_at: expires };
}

/** Get a share by ID. Returns null if not found or expired. */
export function getShare(
  db: Database.Database,
  shareId: string
): Share | null {
  const row = db
    .prepare("SELECT * FROM shares WHERE id = ?")
    .get(shareId) as Share | undefined;

  if (!row) return null;
  if (row.expires_at && row.expires_at < new Date().toISOString()) return null;

  return row;
}
