import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import type { Pool } from "pg";
import { createPool, initSchema, extractUsername } from "@/lib/db";
import { recordEvent, getEvents } from "@/lib/events";
import { getSession } from "@/lib/sessions";

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

describe("recordEvent", () => {
  it("creates session on first event", async () => {
    await recordEvent(pool, {
      session_id: "s1",
      hook_event_name: "SessionStart",
      cwd: "/home/user/project",
    });

    const s = await getSession(pool, "s1");
    expect(s).not.toBeNull();
    expect(s!.project_dir).toBe("/home/user/project");
    expect(s!.event_count).toBe(1);
  });

  it("increments counters correctly", async () => {
    await recordEvent(pool, { session_id: "s1", hook_event_name: "SessionStart", cwd: "/tmp" });
    await recordEvent(pool, { session_id: "s1", hook_event_name: "UserPromptSubmit", prompt: "hi" });
    await recordEvent(pool, { session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "ls" } });
    await recordEvent(pool, { session_id: "s1", hook_event_name: "PostToolUse", tool_name: "Bash" });

    const s = await getSession(pool, "s1");
    expect(s!.event_count).toBe(4);
    expect(s!.prompt_count).toBe(1);
    expect(s!.tool_count).toBe(2);
  });

  it("records session end timestamp", async () => {
    await recordEvent(pool, { session_id: "s1", hook_event_name: "SessionStart", cwd: "/tmp" });
    await recordEvent(pool, { session_id: "s1", hook_event_name: "SessionEnd", end_reason: "user_exit" });

    const s = await getSession(pool, "s1");
    expect(s!.ended_at).not.toBeNull();
  });

  it("builds summary for prompt events", async () => {
    await recordEvent(pool, {
      session_id: "s1",
      hook_event_name: "UserPromptSubmit",
      prompt: "Fix the auth bug",
    });

    const events = await getEvents(pool, "s1");
    expect(events[0].summary).toBe("Fix the auth bug");
  });

  it("builds summary for bash tool", async () => {
    await recordEvent(pool, {
      session_id: "s1",
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "npm test" },
    });

    const events = await getEvents(pool, "s1");
    expect(events[0].summary).toBe("$ npm test");
  });

  it("builds summary for file tools", async () => {
    await recordEvent(pool, {
      session_id: "s1",
      hook_event_name: "PreToolUse",
      tool_name: "Read",
      tool_input: { file_path: "/src/auth.ts" },
    });

    const events = await getEvents(pool, "s1");
    expect(events[0].summary).toBe("/src/auth.ts");
  });

  it("stores full payload as JSON", async () => {
    await recordEvent(pool, {
      session_id: "s1",
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "echo hello", timeout: 5000 },
    });

    const events = await getEvents(pool, "s1");
    expect(events[0].payload.tool_input).toEqual({ command: "echo hello", timeout: 5000 });
  });
});

describe("getEvents", () => {
  it("returns events in chronological order", async () => {
    await recordEvent(pool, { session_id: "s1", hook_event_name: "SessionStart" });
    await recordEvent(pool, { session_id: "s1", hook_event_name: "UserPromptSubmit", prompt: "hi" });
    await recordEvent(pool, { session_id: "s1", hook_event_name: "Stop" });

    const events = await getEvents(pool, "s1");
    expect(events).toHaveLength(3);
    expect(events[0].hook_event_name).toBe("SessionStart");
    expect(events[2].hook_event_name).toBe("Stop");
  });

  it("respects limit", async () => {
    for (let i = 0; i < 10; i++) {
      await recordEvent(pool, { session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Read" });
    }

    const events = await getEvents(pool, "s1", 3);
    expect(events).toHaveLength(3);
  });

  it("returns empty array for unknown session", async () => {
    expect(await getEvents(pool, "nonexistent")).toEqual([]);
  });
});

describe("extractUsername", () => {
  it("extracts from linux transcript_path", () => {
    expect(extractUsername({ transcript_path: "/home/rmondo/.claude/proj/abc.jsonl" })).toBe("rmondo");
  });

  it("extracts from macOS cwd", () => {
    expect(extractUsername({ cwd: "/Users/alice/projects/myapp" })).toBe("alice");
  });

  it("prefers transcript_path over cwd", () => {
    expect(extractUsername({
      transcript_path: "/home/alice/.claude/proj/abc.jsonl",
      cwd: "/home/bob/project",
    })).toBe("alice");
  });

  it("returns unknown when no path", () => {
    expect(extractUsername({})).toBe("unknown");
  });
});

describe("recordEvent sets username", () => {
  it("extracts username from cwd on session creation", async () => {
    await recordEvent(pool, {
      session_id: "s1",
      hook_event_name: "SessionStart",
      cwd: "/home/rmondo/repos/myapp",
    });

    const s = await getSession(pool, "s1");
    expect(s!.username).toBe("rmondo");
  });

  it("extracts username from transcript_path", async () => {
    await recordEvent(pool, {
      session_id: "s1",
      hook_event_name: "SessionStart",
      transcript_path: "/home/alice/.claude/proj/abc.jsonl",
      cwd: "/tmp",
    });

    const s = await getSession(pool, "s1");
    expect(s!.username).toBe("alice");
  });
});
