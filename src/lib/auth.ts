import crypto from "crypto";
import type { Pool } from "pg";
import type { AuthContext } from "./types";

const AUTH_ENABLED = process.env.AUTH_ENABLED === "true";
const AUTH_SECRET = process.env.AUTH_SECRET ?? "claude-logger-default-secret";

/** Check if authentication is enabled. */
export function isAuthEnabled(): boolean {
  return AUTH_ENABLED;
}

/** SHA-256 hash of an API key. */
export function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/** Generate a random API key. */
function generateKey(): string {
  return `cl_${crypto.randomBytes(24).toString("hex")}`;
}

/** Create a new API key for a user. Returns the plain-text key (only shown once). */
export async function createApiKey(
  pool: Pool,
  username: string,
  role: "admin" | "viewer" = "viewer",
  label = ""
): Promise<{ key: string; id: number }> {
  const key = generateKey();
  const keyHash = hashKey(key);
  const { rows } = await pool.query(
    `INSERT INTO api_keys (key_hash, username, role, label)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [keyHash, username, role, label]
  );
  return { key, id: rows[0].id };
}

/** Validate an API key. Returns auth context or null. */
export async function validateApiKey(
  pool: Pool,
  key: string
): Promise<AuthContext | null> {
  const keyHash = hashKey(key);
  const { rows } = await pool.query(
    `UPDATE api_keys SET last_used_at = NOW()
     WHERE key_hash = $1
     RETURNING id, username, role`,
    [keyHash]
  );
  if (rows.length === 0) return null;
  return {
    username: rows[0].username,
    role: rows[0].role,
    key_id: rows[0].id,
  };
}

/** Create a signed session cookie value. */
export function createSessionToken(username: string, role: string): string {
  const payload = JSON.stringify({ username, role, exp: Date.now() + 7 * 24 * 3600 * 1000 });
  const b64 = Buffer.from(payload).toString("base64url");
  const sig = crypto.createHmac("sha256", AUTH_SECRET).update(b64).digest("base64url");
  return `${b64}.${sig}`;
}

/** Validate a session cookie. Returns auth context or null. */
export function validateSessionToken(token: string): AuthContext | null {
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;
  const expected = crypto.createHmac("sha256", AUTH_SECRET).update(b64).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const payload = JSON.parse(Buffer.from(b64, "base64url").toString());
    if (payload.exp && payload.exp < Date.now()) return null;
    return { username: payload.username, role: payload.role };
  } catch {
    return null;
  }
}

/** List all API keys (admin only). Returns metadata, not the keys themselves. */
export async function listApiKeys(pool: Pool): Promise<
  { id: number; username: string; role: string; label: string; created_at: string; last_used_at: string | null }[]
> {
  const { rows } = await pool.query(
    `SELECT id, username, role, label, created_at, last_used_at
     FROM api_keys ORDER BY created_at DESC`
  );
  return rows;
}

/** Delete an API key by ID. */
export async function deleteApiKey(pool: Pool, id: number): Promise<boolean> {
  const { rowCount } = await pool.query("DELETE FROM api_keys WHERE id = $1", [id]);
  return (rowCount ?? 0) > 0;
}

/**
 * Extract auth context from a request.
 * Checks: Bearer token, then session cookie.
 * If auth is disabled, returns a default admin context.
 */
export async function getAuthContext(
  request: Request,
  pool: Pool
): Promise<AuthContext | null> {
  if (!AUTH_ENABLED) {
    return { username: "anonymous", role: "admin" };
  }

  // Check Bearer token
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const key = authHeader.slice(7);
    return validateApiKey(pool, key);
  }

  // Check session cookie
  const cookies = request.headers.get("cookie") ?? "";
  const match = cookies.match(/cl_session=([^;]+)/);
  if (match) {
    return validateSessionToken(match[1]);
  }

  return null;
}
