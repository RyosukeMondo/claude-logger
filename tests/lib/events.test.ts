import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { openDb, extractUsername } from "@/lib/db";
import { recordEvent, getEvents } from "@/lib/events";
import { getSession } from "@/lib/sessions";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";

function tmpDb(): Database.Database {
  return openDb(join(tmpdir(), `claude-logger-test-${randomBytes(8).toString("hex")}.db`));
}

describe("recordEvent", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = tmpDb();
  });

  it("creates session on first event", () => {
    recordEvent(db, {
      session_id: "s1",
      hook_event_name: "SessionStart",
      cwd: "/home/user/project",
    });

    const s = getSession(db, "s1");
    expect(s).not.toBeNull();
    expect(s!.project_dir).toBe("/home/user/project");
    expect(s!.event_count).toBe(1);
  });

  it("increments counters correctly", () => {
    recordEvent(db, { session_id: "s1", hook_event_name: "SessionStart", cwd: "/tmp" });
    recordEvent(db, { session_id: "s1", hook_event_name: "UserPromptSubmit", prompt: "hi" });
    recordEvent(db, { session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "ls" } });
    recordEvent(db, { session_id: "s1", hook_event_name: "PostToolUse", tool_name: "Bash" });

    const s = getSession(db, "s1");
    expect(s!.event_count).toBe(4);
    expect(s!.prompt_count).toBe(1);
    expect(s!.tool_count).toBe(2); // PreToolUse + PostToolUse both have tool_name
  });

  it("records session end timestamp", () => {
    recordEvent(db, { session_id: "s1", hook_event_name: "SessionStart", cwd: "/tmp" });
    recordEvent(db, { session_id: "s1", hook_event_name: "SessionEnd", end_reason: "user_exit" });

    const s = getSession(db, "s1");
    expect(s!.ended_at).not.toBeNull();
  });

  it("builds summary for prompt events", () => {
    recordEvent(db, {
      session_id: "s1",
      hook_event_name: "UserPromptSubmit",
      prompt: "Fix the auth bug",
    });

    const events = getEvents(db, "s1");
    expect(events[0].summary).toBe("Fix the auth bug");
  });

  it("builds summary for bash tool", () => {
    recordEvent(db, {
      session_id: "s1",
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "npm test" },
    });

    const events = getEvents(db, "s1");
    expect(events[0].summary).toBe("$ npm test");
  });

  it("builds summary for file tools", () => {
    recordEvent(db, {
      session_id: "s1",
      hook_event_name: "PreToolUse",
      tool_name: "Read",
      tool_input: { file_path: "/src/auth.ts" },
    });

    const events = getEvents(db, "s1");
    expect(events[0].summary).toBe("/src/auth.ts");
  });

  it("stores full payload as JSON", () => {
    const event = {
      session_id: "s1",
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "echo hello", timeout: 5000 },
    };
    recordEvent(db, event);

    const events = getEvents(db, "s1");
    expect(events[0].payload.tool_input).toEqual({ command: "echo hello", timeout: 5000 });
  });
});

describe("getEvents", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = tmpDb();
  });

  it("returns events in chronological order", () => {
    recordEvent(db, { session_id: "s1", hook_event_name: "SessionStart" });
    recordEvent(db, { session_id: "s1", hook_event_name: "UserPromptSubmit", prompt: "hi" });
    recordEvent(db, { session_id: "s1", hook_event_name: "Stop" });

    const events = getEvents(db, "s1");
    expect(events).toHaveLength(3);
    expect(events[0].hook_event_name).toBe("SessionStart");
    expect(events[2].hook_event_name).toBe("Stop");
  });

  it("respects limit", () => {
    for (let i = 0; i < 10; i++) {
      recordEvent(db, { session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Read" });
    }

    const events = getEvents(db, "s1", 3);
    expect(events).toHaveLength(3);
  });

  it("returns empty array for unknown session", () => {
    expect(getEvents(db, "nonexistent")).toEqual([]);
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
  let db: Database.Database;

  beforeEach(() => {
    db = tmpDb();
  });

  it("extracts username from cwd on session creation", () => {
    recordEvent(db, {
      session_id: "s1",
      hook_event_name: "SessionStart",
      cwd: "/home/rmondo/repos/myapp",
    });

    const s = getSession(db, "s1");
    expect(s!.username).toBe("rmondo");
  });

  it("extracts username from transcript_path", () => {
    recordEvent(db, {
      session_id: "s1",
      hook_event_name: "SessionStart",
      transcript_path: "/home/alice/.claude/proj/abc.jsonl",
      cwd: "/tmp",
    });

    const s = getSession(db, "s1");
    expect(s!.username).toBe("alice");
  });
});
