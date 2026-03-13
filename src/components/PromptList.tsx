import type { EventRecord } from "@/lib/types";
import DeleteEventButton from "./DeleteEventButton";

export default function PromptList({ events }: { events: EventRecord[] }) {
  const prompts = events.filter((e) => e.hook_event_name === "UserPromptSubmit");

  if (prompts.length === 0) return null;

  return (
    <div className="panel">
      <div className="panel-header">
        <span>USER PROMPTS</span>
        <span>{prompts.length} total</span>
      </div>
      <div className="panel-body">
        {prompts.map((p, i) => (
          <div key={p.id} style={{ marginBottom: i < prompts.length - 1 ? 12 : 0 }}>
            <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--gray-lt)", marginBottom: 4, alignItems: "center" }}>
              <span>#{i + 1}</span>
              <span>{p.timestamp?.slice(11, 19)}</span>
              <DeleteEventButton eventId={p.id} />
            </div>
            <div className="prompt-text" style={{ whiteSpace: "pre-wrap" }}>
              {(p.payload?.prompt as string) ?? p.summary}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
