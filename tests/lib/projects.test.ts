import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import type { Pool } from "pg";
import { createPool, initSchema, extractProjectName } from "@/lib/db";
import { recordEvent } from "@/lib/events";
import { listProjects } from "@/lib/projects";

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

describe("extractProjectName", () => {
  it("extracts from linux path", () => {
    expect(extractProjectName("/home/user/repos/my-app")).toBe("my-app");
  });

  it("extracts from macOS path", () => {
    expect(extractProjectName("/Users/alice/projects/web")).toBe("web");
  });

  it("extracts from windows path", () => {
    expect(extractProjectName("C:\\Users\\bob\\code\\myproj")).toBe("myproj");
  });

  it("handles trailing slashes", () => {
    expect(extractProjectName("/home/user/repos/app/")).toBe("app");
  });

  it("returns empty for empty string", () => {
    expect(extractProjectName("")).toBe("");
  });

  it("handles single component", () => {
    expect(extractProjectName("/tmp")).toBe("tmp");
  });
});

describe("listProjects", () => {
  it("returns empty for no sessions", async () => {
    expect(await listProjects(pool)).toEqual([]);
  });

  it("groups sessions by project name", async () => {
    await recordEvent(pool, { session_id: "s1", hook_event_name: "SessionStart", cwd: "/home/user/repos/app1" });
    await recordEvent(pool, { session_id: "s2", hook_event_name: "SessionStart", cwd: "/home/user/repos/app1" });
    await recordEvent(pool, { session_id: "s3", hook_event_name: "SessionStart", cwd: "/home/user/repos/app2" });

    const projects = await listProjects(pool);
    expect(projects).toHaveLength(2);
    const app1 = projects.find((p) => p.project_name === "app1");
    expect(app1?.session_count).toBe(2);
  });

  it("filters by username", async () => {
    await recordEvent(pool, { session_id: "s1", hook_event_name: "SessionStart", cwd: "/home/alice/repos/proj" });
    await recordEvent(pool, { session_id: "s2", hook_event_name: "SessionStart", cwd: "/home/bob/repos/proj" });

    const projects = await listProjects(pool, "alice");
    expect(projects).toHaveLength(1);
  });
});
