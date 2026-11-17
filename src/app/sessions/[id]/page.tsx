import { notFound } from "next/navigation";
import Link from "next/link";
import { getPool } from "@/lib/db";
import { getSession } from "@/lib/sessions";
import { getEvents } from "@/lib/events";
import PromptList from "@/components/PromptList";
import FilterableTimeline from "@/components/FilterableTimeline";
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
            {(session.total_input_tokens > 0 || session.total_output_tokens > 0) && (
              <>
                <div>
                  <div className="stat-value" style={{ color: "var(--amber)" }}>
                    ${session.total_cost_usd.toFixed(4)}
                  </div>
                  <div className="stat-label">EST. COST</div>
                </div>
                <div>
                  <div className="stat-value" style={{ fontSize: 16 }}>
                    {fmtTokens(session.total_input_tokens + session.total_output_tokens)}
                  </div>
                  <div className="stat-label">TOKENS</div>
                </div>
              </>
            )}
          </div>
          <div
            style={{ marginTop: 12, fontSize: 12, color: "var(--gray-lt)" }}
          >
            USER: <span style={{ color: "var(--cyan)" }}>{session.username || "unknown"}</span>
            <br />
            PROJECT: {session.project_name || session.project_dir || "unknown"}
            <br />
            STARTED: {session.started_at ?? "unknown"}
            <br />
            {session.ended_at && <>ENDED: {session.ended_at}</>}
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <ShareButton sessionId={session.id} />
            <Link href={`/sessions/${id}/conversation`} className="btn btn-amber">
              [CONVERSATION VIEW]
            </Link>
          </div>
        </div>
      </div>
      <PromptList events={events} />
      <FilterableTimeline events={events} />
    </>
  );
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
