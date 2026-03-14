import { getPool } from "@/lib/db";
import { listUsers, listSessions, getStats } from "@/lib/sessions";
import StatsBar from "@/components/StatsBar";
import ToolUsageBar from "@/components/ToolUsageBar";
import SessionTable from "@/components/SessionTable";
import SessionTimeline from "@/components/SessionTimeline";
import UserFilter from "@/components/UserFilter";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  const { user } = await searchParams;
  const pool = await getPool();
  const users = await listUsers(pool);
  const stats = await getStats(pool, user);
  const sessions = await listSessions(pool, 50, 0, user);

  return (
    <>
      <UserFilter users={users} />
      <StatsBar stats={stats} />
      <ToolUsageBar tools={stats.tool_usage} />
      <SessionTimeline sessions={sessions} />
      <SessionTable sessions={sessions} />
    </>
  );
}
