import type { EventRecord, ConversationTurn, ToolCall } from "./types";

/**
 * Build a conversation view from a chronological list of events.
 * Groups events into turns: UserPromptSubmit → tool calls → Stop.
 */
export function buildConversation(events: EventRecord[]): ConversationTurn[] {
  const turns: ConversationTurn[] = [];
  let currentTurn: ConversationTurn | null = null;
  // Track tool calls: PreToolUse starts one, PostToolUse/PostToolUseFailure completes it
  let pendingTool: Partial<ToolCall> | null = null;

  for (const e of events) {
    switch (e.hook_event_name) {
      case "UserPromptSubmit": {
        // Close previous turn if open
        if (currentTurn) turns.push(currentTurn);
        currentTurn = {
          prompt: (e.payload?.prompt as string) ?? e.summary,
          prompt_timestamp: e.timestamp,
          tool_calls: [],
          stop_reason: null,
          response_timestamp: null,
        };
        pendingTool = null;
        break;
      }

      case "PreToolUse": {
        if (!currentTurn) break;
        // Start a new pending tool call
        pendingTool = {
          name: e.tool_name ?? "unknown",
          input: (e.payload?.tool_input as Record<string, unknown>) ?? {},
          summary: e.summary,
          response: null,
          success: true,
        };
        break;
      }

      case "PostToolUse": {
        if (!currentTurn) break;
        const toolResponse = (e.payload?.tool_response as Record<string, unknown>) ?? null;
        if (pendingTool && pendingTool.name === e.tool_name) {
          currentTurn.tool_calls.push({
            name: pendingTool.name!,
            input: pendingTool.input ?? {},
            response: toolResponse,
            success: true,
            summary: pendingTool.summary ?? e.summary,
          });
        } else {
          currentTurn.tool_calls.push({
            name: e.tool_name ?? "unknown",
            input: {},
            response: toolResponse,
            success: true,
            summary: e.summary,
          });
        }
        pendingTool = null;
        break;
      }

      case "PostToolUseFailure": {
        if (!currentTurn) break;
        const failResponse = (e.payload?.tool_response as Record<string, unknown>) ?? null;
        if (pendingTool && pendingTool.name === e.tool_name) {
          currentTurn.tool_calls.push({
            name: pendingTool.name!,
            input: pendingTool.input ?? {},
            response: failResponse,
            success: false,
            summary: pendingTool.summary ?? e.summary,
          });
        } else {
          currentTurn.tool_calls.push({
            name: e.tool_name ?? "unknown",
            input: {},
            response: failResponse,
            success: false,
            summary: e.summary,
          });
        }
        pendingTool = null;
        break;
      }

      case "Stop": {
        if (!currentTurn) break;
        currentTurn.stop_reason = (e.payload?.stop_reason as string) ?? "completed";
        currentTurn.response_timestamp = e.timestamp;
        break;
      }

      // SessionStart, SessionEnd, Notification — skip
      default:
        break;
    }
  }

  // Push last open turn
  if (currentTurn) turns.push(currentTurn);

  return turns;
}
