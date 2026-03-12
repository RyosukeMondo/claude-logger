import { notFound } from "next/navigation";
import { getPool } from "@/lib/db";
import { getSession } from "@/lib/sessions";
import { getEvents } from "@/lib/events";
import PromptList from "@/components/PromptList";
import Timeline from "@/components/Timeline";
import ShareButton from "@/components/ShareButton";

export const dynamic = "force-dynamic";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pool = await getPool();
  const session = await getSession(pool, id);
  if (!session) notFound();

  const events = await getEvents(pool, id);

  return (
    <>
      <div className="panel">
        <div className="panel-header">
          <span>SESSION {session.id.slice(0, 16)}</span>
          <span>{session.event_count} events</span>
        </div>
        <div className="panel-body">
          <div className="stats-bar">
            <div>
              <div className="stat-value">{session.prompt_count}</div>
              <div className="stat-label">PROMPTS</div>
            </div>
            <div>
              <div className="stat-value">{session.tool_count}</div>
              <div className="stat-label">TOOL CALLS</div>
            </div>
            <div>
              <div className="stat-value">
                {session.permission_mode ?? "default"}
              </div>
              <div className="stat-label">MODE</div>
            </div>
          </div>
          <div
            style={{ marginTop: 12, fontSize: 12, color: "var(--gray-lt)" }}
          >
            USER: <span style={{ color: "var(--cyan)" }}>{session.username || "unknown"}</span>
            <br />
            PROJECT: {session.project_dir || "unknown"}
            <br />
            STARTED: {session.started_at ?? "unknown"}
            <br />
            {session.ended_at && <>ENDED: {session.ended_at}</>}
          </div>
          <ShareButton sessionId={session.id} />
        </div>
      </div>
      <PromptList events={events} />
      <Timeline events={events} />
    </>
  );
}
