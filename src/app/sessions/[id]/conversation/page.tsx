import { notFound } from "next/navigation";
import Link from "next/link";
import { getPool } from "@/lib/db";
import { getSession } from "@/lib/sessions";
import { getEvents } from "@/lib/events";
import { buildConversation } from "@/lib/conversation";
import ConversationView from "@/components/ConversationView";

export const dynamic = "force-dynamic";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pool = await getPool();
  const session = await getSession(pool, id);
  if (!session) notFound();

  const events = await getEvents(pool, id);
  const turns = buildConversation(events);

  return (
    <>
      <div className="panel">
        <div className="panel-header">
          <span>CONVERSATION — {session.id.slice(0, 16)}</span>
          <span>{turns.length} turns</span>
        </div>
        <div className="panel-body" style={{ fontSize: 12, color: "var(--gray-lt)" }}>
          <Link href={`/sessions/${id}`} className="btn" style={{ marginRight: 8 }}>
            [TIMELINE VIEW]
          </Link>
          USER: <span style={{ color: "var(--cyan)" }}>{session.username || "unknown"}</span>
          {" | "}PROJECT: {session.project_name || session.project_dir || "unknown"}
        </div>
      </div>
      <ConversationView turns={turns} />
    </>
  );
}
