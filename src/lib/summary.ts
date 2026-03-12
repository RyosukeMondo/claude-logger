import type { HookEvent } from "./types";

/** Build a human-readable one-line summary from a hook event. */
export function buildSummary(event: HookEvent): string {
  const { hook_event_name, tool_input, prompt, message, end_reason } = event;

  switch (hook_event_name) {
    case "SessionStart":
      return `Session ${event.session_source ?? "startup"}`;

    case "SessionEnd":
      return `Session ended: ${end_reason ?? "unknown"}`;

    case "UserPromptSubmit":
      return truncate(prompt ?? "", 120);

    case "PreToolUse":
      return toolSummary(event.tool_name ?? "?", tool_input ?? {});

    case "PostToolUse":
      return `${event.tool_name ?? "?"} completed`;

    case "PostToolUseFailure":
      return `${event.tool_name ?? "?"} failed`;

    case "Notification":
      return truncate(message ?? "", 120);

    case "Stop":
      return "Claude finished responding";

    default:
      return hook_event_name;
  }
}

function toolSummary(
  tool: string,
  input: Record<string, unknown>
): string {
  switch (tool) {
    case "Bash":
      return `$ ${truncate(String(input.command ?? ""), 100)}`;
    case "Read":
      return String(input.file_path ?? "");
    case "Write":
    case "Edit":
      return String(input.file_path ?? "");
    case "Grep":
      return `/${input.pattern ?? ""}/`;
    case "Glob":
      return String(input.pattern ?? "");
    case "Agent":
      return truncate(String(input.description ?? input.prompt ?? ""), 100);
    default:
      return truncate(JSON.stringify(input), 100);
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "..." : s;
}
