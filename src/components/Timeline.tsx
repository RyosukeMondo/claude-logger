import type { EventRecord } from "@/lib/types";
import DeleteEventButton from "./DeleteEventButton";

export default function Timeline({ events }: { events: EventRecord[] }) {
  return (
    <div className="panel">
      <div className="panel-header">
        <span>EVENT TIMELINE</span>
        <span>{events.length} events</span>
      </div>
      <div className="panel-body">
        <div className="timeline">
          {events.map((e) => (
            <div key={e.id} className="tl-ev">
              <span className="tl-time">
                {e.timestamp?.slice(11, 19) ?? ""}
              </span>
              <span className={`tl-dot ${dotClass(e.hook_event_name)}`} />
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flex: 1 }}>
                <div style={{ flex: 1 }}>
                  <span className="tl-label">{e.hook_event_name}</span>
                  {e.tool_name && (
                    <span className="tl-tool"> {e.tool_name}</span>
                  )}
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
    case "SessionStart":
      return "start";
    case "SessionEnd":
      return "end";
    case "UserPromptSubmit":
      return "prompt";
    case "Notification":
      return "notif";
    default:
      return eventName.includes("Tool") ? "tool" : "";
  }
}
