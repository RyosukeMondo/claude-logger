import { getPool } from "@/lib/db";
import { listUsers, listSessions, getStats } from "@/lib/sessions";
import { getPromptTimestamps } from "@/lib/events";
import { formatLocal } from "@/lib/time";
import StatsBar from "@/components/StatsBar";
import ToolUsageBar from "@/components/ToolUsageBar";
import SessionTable from "@/components/SessionTable";
import SessionTimeline from "@/components/SessionTimeline";
import UserFilter from "@/components/UserFilter";
import DateNav from "@/components/DateNav";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; date?: string }>;
}) {
  const { user, date: dateParam } = await searchParams;
  const today = formatLocal(new Date()).slice(0, 10); // YYYY-MM-DD
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;

  const pool = await getPool();
  const users = await listUsers(pool);
  const stats = await getStats(pool, user);
  const sessions = await listSessions(pool, 50, 0, user);

  const promptTimestamps = await getPromptTimestamps(
    pool,
    sessions.map((s) => s.id),
    date
  );
  const promptMap: Record<string, number[]> = {};
  for (const [k, v] of promptTimestamps) {
    promptMap[k] = v;
  }

  return (
    <>
      <UserFilter users={users} />
      <StatsBar stats={stats} />
      <ToolUsageBar tools={stats.tool_usage} />
      <div className="panel">
        <div className="panel-header">
          <span>DATE</span>
          <DateNav date={date} />
        </div>
      </div>
      <SessionTimeline sessions={sessions} promptMap={promptMap} date={date} />
      <SessionTable sessions={sessions} />
    </>
  );
}
