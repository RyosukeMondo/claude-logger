import { notFound } from "next/navigation";
import { getPool } from "@/lib/db";
import { getSession } from "@/lib/sessions";
import { getEvents } from "@/lib/events";
import { getShare } from "@/lib/shares";
import Timeline from "@/components/Timeline";

export const dynamic = "force-dynamic";

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pool = await getPool();
  const share = await getShare(pool, id);
  if (!share) notFound();

  const session = await getSession(pool, share.session_id);
  if (!session) notFound();

  const events = await getEvents(pool, share.session_id);

  return (
    <>
      <div className="panel">
        <div className="panel-header">
          <span>SHARED SESSION</span>
          <span className="share-badge">SHARE: {share.id}</span>
        </div>
        <div className="panel-body">
          <div className="stats-bar">
            <div>
              <div className="stat-value">{session.event_count}</div>
              <div className="stat-label">EVENTS</div>
            </div>
            <div>
              <div className="stat-value">{session.prompt_count}</div>
              <div className="stat-label">PROMPTS</div>
            </div>
            <div>
              <div className="stat-value">{session.tool_count}</div>
              <div className="stat-label">TOOL CALLS</div>
            </div>
          </div>
          <div
            style={{ marginTop: 12, fontSize: 12, color: "var(--gray-lt)" }}
          >
            PROJECT: {session.project_dir || "unknown"}
            <br />
            EXPIRES: {share.expires_at?.slice(0, 19) ?? "never"}
          </div>
        </div>
      </div>
      <Timeline events={events} />
    </>
  );
}
