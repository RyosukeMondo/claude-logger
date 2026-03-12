import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import type { Pool } from "pg";
import { createPool, initSchema } from "@/lib/db";
import { recordEvent } from "@/lib/events";
import { listUsers, listSessions, getSession, getStats } from "@/lib/sessions";

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

describe("listUsers", () => {
  it("returns empty list when no sessions", async () => {
    expect(await listUsers(pool)).toEqual([]);
  });

  it("returns distinct usernames", async () => {
    await recordEvent(pool, { session_id: "s1", hook_event_name: "SessionStart", cwd: "/home/alice/proj" });
    await recordEvent(pool, { session_id: "s2", hook_event_name: "SessionStart", cwd: "/home/bob/proj" });
    await recordEvent(pool, { session_id: "s3", hook_event_name: "SessionStart", cwd: "/home/alice/other" });

    const users = await listUsers(pool);
    expect(users).toEqual(["alice", "bob"]);
  });
});

describe("listSessions with user filter", () => {
  beforeEach(async () => {
    await recordEvent(pool, { session_id: "s1", hook_event_name: "SessionStart", cwd: "/home/alice/proj" });
    await recordEvent(pool, { session_id: "s2", hook_event_name: "SessionStart", cwd: "/home/bob/proj" });
  });

  it("filters by username", async () => {
    const sessions = await listSessions(pool, 50, 0, "alice");
    expect(sessions).toHaveLength(1);
    expect(sessions[0].username).toBe("alice");
  });

  it("returns all when no filter", async () => {
    expect(await listSessions(pool)).toHaveLength(2);
  });
});

describe("getStats with user filter", () => {
  beforeEach(async () => {
    await recordEvent(pool, { session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Bash", cwd: "/home/alice/p" });
    await recordEvent(pool, { session_id: "s2", hook_event_name: "PreToolUse", tool_name: "Read", cwd: "/home/bob/p" });
  });

  it("filters stats by user", async () => {
    const stats = await getStats(pool, "alice");
    expect(stats.total_sessions).toBe(1);
    expect(stats.total_events).toBe(1);
    expect(stats.tool_usage).toEqual([{ name: "Bash", count: 1 }]);
  });
});

describe("listSessions", () => {
  it("returns empty list when no sessions", async () => {
    expect(await listSessions(pool)).toEqual([]);
  });

  it("returns sessions ordered by started_at desc", async () => {
    await recordEvent(pool, { session_id: "s1", hook_event_name: "SessionStart", cwd: "/a" });
    await recordEvent(pool, { session_id: "s2", hook_event_name: "SessionStart", cwd: "/b" });

    const sessions = await listSessions(pool);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].id).toBe("s2");
  });

  it("respects limit and offset", async () => {
    for (let i = 0; i < 5; i++) {
      await recordEvent(pool, { session_id: `s${i}`, hook_event_name: "SessionStart" });
    }

    const page = await listSessions(pool, 2, 2);
    expect(page).toHaveLength(2);
  });
});

describe("getSession", () => {
  it("returns null for unknown session", async () => {
    expect(await getSession(pool, "nonexistent")).toBeNull();
  });

  it("returns session with correct fields", async () => {
    await recordEvent(pool, {
      session_id: "s1",
      hook_event_name: "SessionStart",
      cwd: "/home/user/project",
      permission_mode: "default",
    });

    const s = await getSession(pool, "s1");
    expect(s).not.toBeNull();
    expect(s!.id).toBe("s1");
    expect(s!.project_dir).toBe("/home/user/project");
    expect(s!.permission_mode).toBe("default");
  });
});

describe("getStats", () => {
  it("returns zero stats for empty db", async () => {
    const stats = await getStats(pool);
    expect(stats.total_sessions).toBe(0);
    expect(stats.total_events).toBe(0);
    expect(stats.tool_usage).toEqual([]);
  });

  it("counts tool usage correctly", async () => {
    await recordEvent(pool, { session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Bash" });
    await recordEvent(pool, { session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Bash" });
    await recordEvent(pool, { session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Read" });

    const stats = await getStats(pool);
    expect(stats.total_events).toBe(3);
    expect(stats.tool_usage).toEqual([
      { name: "Bash", count: 2 },
      { name: "Read", count: 1 },
    ]);
  });

  it("includes recent activity", async () => {
    await recordEvent(pool, { session_id: "s1", hook_event_name: "UserPromptSubmit", prompt: "hello" });

    const stats = await getStats(pool);
    expect(stats.recent_activity).toHaveLength(1);
    expect(stats.recent_activity[0].hook_event_name).toBe("UserPromptSubmit");
  });
});
