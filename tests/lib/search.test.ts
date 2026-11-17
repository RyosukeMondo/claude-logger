import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import type { Pool } from "pg";
import { createPool, initSchema } from "@/lib/db";
import { recordEvent } from "@/lib/events";
import { searchEvents } from "@/lib/search";

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

describe("searchEvents", () => {
  it("returns empty for empty query", async () => {
    const result = await searchEvents(pool, "");
    expect(result.results).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("finds events by summary text", async () => {
    await recordEvent(pool, {
      session_id: "s1",
      hook_event_name: "UserPromptSubmit",
      prompt: "Fix the authentication bug",
      cwd: "/home/user/project",
    });
    await recordEvent(pool, {
      session_id: "s1",
      hook_event_name: "UserPromptSubmit",
      prompt: "Update the README",
      cwd: "/home/user/project",
    });

    const result = await searchEvents(pool, "authentication");
    expect(result.total).toBe(1);
    expect(result.results[0].event.summary).toContain("authentication");
  });

  it("finds events by tool name", async () => {
    await recordEvent(pool, {
      session_id: "s1",
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "npm test" },
      cwd: "/home/user/project",
    });

    const result = await searchEvents(pool, "Bash");
    expect(result.total).toBeGreaterThan(0);
  });

  it("filters by username", async () => {
    await recordEvent(pool, {
      session_id: "s1",
      hook_event_name: "UserPromptSubmit",
      prompt: "Hello world",
      cwd: "/home/alice/project",
    });
    await recordEvent(pool, {
      session_id: "s2",
      hook_event_name: "UserPromptSubmit",
      prompt: "Hello world",
      cwd: "/home/bob/project",
    });

    const result = await searchEvents(pool, "Hello", { username: "alice" });
    expect(result.total).toBe(1);
    expect(result.results[0].session_username).toBe("alice");
  });

  it("respects limit and offset", async () => {
    for (let i = 0; i < 5; i++) {
      await recordEvent(pool, {
        session_id: "s1",
        hook_event_name: "UserPromptSubmit",
        prompt: `Test prompt number ${i}`,
        cwd: "/home/user/project",
      });
    }

    const result = await searchEvents(pool, "Test", { limit: 2, offset: 0 });
    expect(result.results).toHaveLength(2);
    expect(result.total).toBe(5);
  });

  it("handles short queries with ILIKE", async () => {
    await recordEvent(pool, {
      session_id: "s1",
      hook_event_name: "UserPromptSubmit",
      prompt: "ls",
      cwd: "/home/user/project",
    });

    const result = await searchEvents(pool, "ls");
    expect(result.total).toBeGreaterThan(0);
  });
});
