import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import type { Pool } from "pg";
import { createPool, initSchema } from "@/lib/db";
import { recordEvent } from "@/lib/events";
import { createShare, getShare } from "@/lib/shares";

const TEST_URL = process.env.TEST_DATABASE_URL ?? "postgresql://localhost:5432/claude_logger_test";
let pool: Pool;

beforeAll(async () => {
  pool = createPool(TEST_URL);
  await initSchema(pool);
});

beforeEach(async () => {
  await pool.query("TRUNCATE events, shares, sessions CASCADE");
});

afterAll(async () => {
  await pool.end();
});

describe("shares", () => {
  beforeEach(async () => {
    await recordEvent(pool, { session_id: "s1", hook_event_name: "SessionStart", cwd: "/tmp" });
  });

  it("creates a share with valid id", async () => {
    const share = await createShare(pool, "s1");
    expect(share.id).toHaveLength(12);
    expect(share.session_id).toBe("s1");
    expect(share.expires_at).not.toBeNull();
  });

  it("retrieves share by id", async () => {
    const created = await createShare(pool, "s1");
    const retrieved = await getShare(pool, created.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.session_id).toBe("s1");
  });

  it("returns null for unknown share id", async () => {
    expect(await getShare(pool, "nonexistent")).toBeNull();
  });

  it("respects custom expiry days", async () => {
    const share = await createShare(pool, "s1", 30);
    const expires = new Date(share.expires_at!);
    const now = new Date();
    const diffDays = (expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(29);
    expect(diffDays).toBeLessThan(31);
  });
});
