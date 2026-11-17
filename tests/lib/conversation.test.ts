import { describe, it, expect } from "vitest";
import { buildConversation } from "@/lib/conversation";
import type { EventRecord } from "@/lib/types";

function makeEvent(overrides: Partial<EventRecord>): EventRecord {
  return {
    id: 1,
    session_id: "s1",
    hook_event_name: "UserPromptSubmit",
    tool_name: null,
    summary: "",
    timestamp: "2024-01-01T12:00:00",
    payload: {},
    ...overrides,
  };
}

describe("buildConversation", () => {
  it("returns empty for no events", () => {
    expect(buildConversation([])).toEqual([]);
  });

  it("creates a single turn from a prompt", () => {
    const events = [
      makeEvent({
        id: 1,
        hook_event_name: "UserPromptSubmit",
        summary: "Fix the bug",
        payload: { prompt: "Fix the bug" },
      }),
    ];
    const turns = buildConversation(events);
    expect(turns).toHaveLength(1);
    expect(turns[0].prompt).toBe("Fix the bug");
  });

  it("groups tool calls into the current turn", () => {
    const events = [
      makeEvent({
        id: 1,
        hook_event_name: "UserPromptSubmit",
        summary: "Read file",
        payload: { prompt: "Read file" },
      }),
      makeEvent({
        id: 2,
        hook_event_name: "PreToolUse",
        tool_name: "Read",
        summary: "/src/main.ts",
        payload: { tool_input: { file_path: "/src/main.ts" } },
      }),
      makeEvent({
        id: 3,
        hook_event_name: "PostToolUse",
        tool_name: "Read",
        summary: "Read completed",
        payload: { tool_response: { content: "file contents" } },
      }),
      makeEvent({
        id: 4,
        hook_event_name: "Stop",
        summary: "Claude finished responding",
        payload: { stop_reason: "end_turn" },
      }),
    ];

    const turns = buildConversation(events);
    expect(turns).toHaveLength(1);
    expect(turns[0].tool_calls).toHaveLength(1);
    expect(turns[0].tool_calls[0].name).toBe("Read");
    expect(turns[0].tool_calls[0].success).toBe(true);
    expect(turns[0].stop_reason).toBe("end_turn");
  });

  it("creates multiple turns for multiple prompts", () => {
    const events = [
      makeEvent({ id: 1, hook_event_name: "UserPromptSubmit", payload: { prompt: "First" } }),
      makeEvent({ id: 2, hook_event_name: "Stop", payload: { stop_reason: "end_turn" } }),
      makeEvent({ id: 3, hook_event_name: "UserPromptSubmit", payload: { prompt: "Second" } }),
      makeEvent({ id: 4, hook_event_name: "Stop", payload: { stop_reason: "end_turn" } }),
    ];

    const turns = buildConversation(events);
    expect(turns).toHaveLength(2);
    expect(turns[0].prompt).toBe("First");
    expect(turns[1].prompt).toBe("Second");
  });

  it("marks failed tool calls", () => {
    const events = [
      makeEvent({ id: 1, hook_event_name: "UserPromptSubmit", payload: { prompt: "Run tests" } }),
      makeEvent({
        id: 2,
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        summary: "$ npm test",
        payload: { tool_input: { command: "npm test" } },
      }),
      makeEvent({
        id: 3,
        hook_event_name: "PostToolUseFailure",
        tool_name: "Bash",
        summary: "Bash failed",
        payload: { tool_response: { error: "exit code 1" } },
      }),
    ];

    const turns = buildConversation(events);
    expect(turns[0].tool_calls[0].success).toBe(false);
  });

  it("skips SessionStart/SessionEnd events", () => {
    const events = [
      makeEvent({ id: 1, hook_event_name: "SessionStart" }),
      makeEvent({ id: 2, hook_event_name: "UserPromptSubmit", payload: { prompt: "Hello" } }),
      makeEvent({ id: 3, hook_event_name: "SessionEnd" }),
    ];

    const turns = buildConversation(events);
    expect(turns).toHaveLength(1);
  });
});
