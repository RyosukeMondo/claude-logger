"use client";

import { useState, useMemo } from "react";
import type { EventRecord } from "@/lib/types";
import DeleteEventButton from "./DeleteEventButton";

const EVENT_TYPES = [
  "SessionStart", "SessionEnd", "UserPromptSubmit",
  "PreToolUse", "PostToolUse", "PostToolUseFailure",
  "Notification", "Stop",
];

export default function FilterableTimeline({ events }: { events: EventRecord[] }) {
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(EVENT_TYPES));
  const [activeTools, setActiveTools] = useState<Set<string> | null>(null); // null = all

  const toolNames = useMemo(() => {
    const names = new Set<string>();
    for (const e of events) {
      if (e.tool_name) names.add(e.tool_name);
    }
    return [...names].sort();
  }, [events]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (!activeTypes.has(e.hook_event_name)) return false;
      if (activeTools && e.tool_name && !activeTools.has(e.tool_name)) return false;
      return true;
    });
  }, [events, activeTypes, activeTools]);

  function toggleType(type: string) {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function toggleTool(tool: string) {
    setActiveTools((prev) => {
      if (prev === null) {
        // First click: show only this tool
        return new Set([tool]);
      }
      const next = new Set(prev);
      if (next.has(tool)) next.delete(tool);
      else next.add(tool);
      // If all selected, reset to null (show all)
      return next.size === toolNames.length ? null : next;
    });
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <span>EVENT TIMELINE</span>
        <span>{filtered.length} / {events.length} events</span>
      </div>
      <div className="panel-body">
        {/* Event type filter */}
        <div className="filter-bar">
          <span className="filter-label">TYPE:</span>
          <button
            className={`filter-btn ${activeTypes.size === EVENT_TYPES.length ? "active" : ""}`}
            onClick={() => setActiveTypes(new Set(EVENT_TYPES))}
          >
            ALL
          </button>
          {EVENT_TYPES.map((type) => (
            <button
              key={type}
              className={`filter-btn ${activeTypes.has(type) ? "active" : ""}`}
              onClick={() => toggleType(type)}
            >
              {shortType(type)}
            </button>
          ))}
        </div>

        {/* Tool filter */}
        {toolNames.length > 0 && (
          <div className="filter-bar" style={{ marginTop: 6 }}>
            <span className="filter-label">TOOL:</span>
            <button
              className={`filter-btn ${activeTools === null ? "active" : ""}`}
              onClick={() => setActiveTools(null)}
            >
              ALL
            </button>
            {toolNames.map((tool) => (
              <button
                key={tool}
                className={`filter-btn ${activeTools === null || activeTools.has(tool) ? "active" : ""}`}
                onClick={() => toggleTool(tool)}
              >
                {tool}
              </button>
            ))}
          </div>
        )}

        {/* Timeline */}
        <div className="timeline" style={{ marginTop: 12 }}>
          {filtered.map((e) => (
            <div key={e.id} className="tl-ev">
              <span className="tl-time">{e.timestamp?.slice(11, 19) ?? ""}</span>
              <span className={`tl-dot ${dotClass(e.hook_event_name)}`} />
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flex: 1 }}>
                <div style={{ flex: 1 }}>
                  <span className="tl-label">{e.hook_event_name}</span>
                  {e.tool_name && <span className="tl-tool"> {e.tool_name}</span>}
                  {e.hook_event_name === "UserPromptSubmit" && e.summary ? (
                    <div className="prompt-text">{e.summary}</div>
                  ) : e.summary ? (
                    <div className="tl-summary">{e.summary}</div>
                  ) : null}
                </div>
                <DeleteEventButton eventId={e.id} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function dotClass(eventName: string): string {
  switch (eventName) {
    case "SessionStart": return "start";
    case "SessionEnd": return "end";
    case "UserPromptSubmit": return "prompt";
    case "Notification": return "notif";
    default: return eventName.includes("Tool") ? "tool" : "";
  }
}

function shortType(type: string): string {
  const map: Record<string, string> = {
    SessionStart: "Start",
    SessionEnd: "End",
    UserPromptSubmit: "Prompt",
    PreToolUse: "Pre",
    PostToolUse: "Post",
    PostToolUseFailure: "Fail",
    Notification: "Notif",
    Stop: "Stop",
  };
  return map[type] ?? type;
}
