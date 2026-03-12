import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { openDb } from "@/lib/db";
import { recordEvent } from "@/lib/events";
import { listUsers, listSessions, getSession, getStats } from "@/lib/sessions";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";

function tmpDb(): Database.Database {
  return openDb(join(tmpdir(), `claude-logger-test-${randomBytes(8).toString("hex")}.db`));
}

describe("listSessions", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = tmpDb();
  });

  it("returns empty list when no sessions", () => {
    expect(listSessions(db)).toEqual([]);
  });

  it("returns sessions ordered by started_at desc", () => {
    recordEvent(db, { session_id: "s1", hook_event_name: "SessionStart", cwd: "/a" });
    recordEvent(db, { session_id: "s2", hook_event_name: "SessionStart", cwd: "/b" });

    const sessions = listSessions(db);
    expect(sessions).toHaveLength(2);
    // s2 was started after s1
    expect(sessions[0].id).toBe("s2");
  });

  it("respects limit and offset", () => {
    for (let i = 0; i < 5; i++) {
      recordEvent(db, { session_id: `s${i}`, hook_event_name: "SessionStart" });
    }

    const page = listSessions(db, 2, 2);
    expect(page).toHaveLength(2);
  });
});

describe("listUsers", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = tmpDb();
  });

  it("returns empty list when no sessions", () => {
    expect(listUsers(db)).toEqual([]);
  });

  it("returns distinct usernames", () => {
    recordEvent(db, { session_id: "s1", hook_event_name: "SessionStart", cwd: "/home/alice/proj" });
    recordEvent(db, { session_id: "s2", hook_event_name: "SessionStart", cwd: "/home/bob/proj" });
    recordEvent(db, { session_id: "s3", hook_event_name: "SessionStart", cwd: "/home/alice/other" });

    const users = listUsers(db);
    expect(users).toEqual(["alice", "bob"]);
  });
});

describe("listSessions with user filter", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = tmpDb();
    recordEvent(db, { session_id: "s1", hook_event_name: "SessionStart", cwd: "/home/alice/proj" });
    recordEvent(db, { session_id: "s2", hook_event_name: "SessionStart", cwd: "/home/bob/proj" });
  });

  it("filters by username", () => {
    const sessions = listSessions(db, 50, 0, "alice");
    expect(sessions).toHaveLength(1);
    expect(sessions[0].username).toBe("alice");
  });

  it("returns all when no filter", () => {
    expect(listSessions(db)).toHaveLength(2);
  });
});

describe("getStats with user filter", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = tmpDb();
    recordEvent(db, { session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Bash", cwd: "/home/alice/p" });
    recordEvent(db, { session_id: "s2", hook_event_name: "PreToolUse", tool_name: "Read", cwd: "/home/bob/p" });
  });

  it("filters stats by user", () => {
    const stats = getStats(db, "alice");
    expect(stats.total_sessions).toBe(1);
    expect(stats.total_events).toBe(1);
    expect(stats.tool_usage).toEqual([{ name: "Bash", count: 1 }]);
  });
});

describe("getSession", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = tmpDb();
  });

  it("returns null for unknown session", () => {
    expect(getSession(db, "nonexistent")).toBeNull();
  });

  it("returns session with correct fields", () => {
    recordEvent(db, {
      session_id: "s1",
      hook_event_name: "SessionStart",
      cwd: "/home/user/project",
      permission_mode: "default",
    });

    const s = getSession(db, "s1");
    expect(s).not.toBeNull();
    expect(s!.id).toBe("s1");
    expect(s!.project_dir).toBe("/home/user/project");
    expect(s!.permission_mode).toBe("default");
  });
});

describe("getStats", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = tmpDb();
  });

  it("returns zero stats for empty db", () => {
    const stats = getStats(db);
    expect(stats.total_sessions).toBe(0);
    expect(stats.total_events).toBe(0);
    expect(stats.tool_usage).toEqual([]);
  });

  it("counts tool usage correctly", () => {
    recordEvent(db, { session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Bash" });
    recordEvent(db, { session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Bash" });
    recordEvent(db, { session_id: "s1", hook_event_name: "PreToolUse", tool_name: "Read" });

    const stats = getStats(db);
    expect(stats.total_events).toBe(3);
    expect(stats.tool_usage).toEqual([
      { name: "Bash", count: 2 },
      { name: "Read", count: 1 },
    ]);
  });

  it("includes recent activity", () => {
    recordEvent(db, { session_id: "s1", hook_event_name: "UserPromptSubmit", prompt: "hello" });

    const stats = getStats(db);
    expect(stats.recent_activity).toHaveLength(1);
    expect(stats.recent_activity[0].hook_event_name).toBe("UserPromptSubmit");
  });
});
