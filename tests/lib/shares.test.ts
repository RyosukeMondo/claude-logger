import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { openDb } from "@/lib/db";
import { recordEvent } from "@/lib/events";
import { createShare, getShare } from "@/lib/shares";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";

function tmpDb(): Database.Database {
  return openDb(join(tmpdir(), `claude-logger-test-${randomBytes(8).toString("hex")}.db`));
}

describe("shares", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = tmpDb();
    recordEvent(db, { session_id: "s1", hook_event_name: "SessionStart", cwd: "/tmp" });
  });

  it("creates a share with valid id", () => {
    const share = createShare(db, "s1");
    expect(share.id).toHaveLength(12);
    expect(share.session_id).toBe("s1");
    expect(share.expires_at).not.toBeNull();
  });

  it("retrieves share by id", () => {
    const created = createShare(db, "s1");
    const retrieved = getShare(db, created.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.session_id).toBe("s1");
  });

  it("returns null for unknown share id", () => {
    expect(getShare(db, "nonexistent")).toBeNull();
  });

  it("respects custom expiry days", () => {
    const share = createShare(db, "s1", 30);
    const expires = new Date(share.expires_at!);
    const now = new Date();
    const diffDays = (expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(29);
    expect(diffDays).toBeLessThan(31);
  });
});
