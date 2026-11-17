import { getPool } from "@/lib/db";
import { listUsers, listSessions, getStats, countSessions } from "@/lib/sessions";
import { getPromptTimestamps } from "@/lib/events";
import { listProjects } from "@/lib/projects";
import { formatLocal } from "@/lib/time";
import StatsBar from "@/components/StatsBar";
import CostBar from "@/components/CostBar";
import ToolUsageBar from "@/components/ToolUsageBar";
import SessionTimeline from "@/components/SessionTimeline";
import PaginatedSessionTable from "@/components/PaginatedSessionTable";
import ProjectList from "@/components/ProjectList";
import UserFilter from "@/components/UserFilter";
import DateNav from "@/components/DateNav";
import SearchBar from "@/components/SearchBar";
import ExportButton from "@/components/ExportButton";

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
  const [users, stats, sessions, total, projects] = await Promise.all([
    listUsers(pool),
    getStats(pool, user),
    listSessions(pool, 50, 0, user),
    countSessions(pool, user),
    listProjects(pool, user),
  ]);

  const promptTimestamps = await getPromptTimestamps(
    pool,
    sessions.map((s) => s.id),
    date
  );
  const promptMap: Record<string, { ts: number; text: string }[]> = {};
  for (const [k, v] of promptTimestamps) {
    promptMap[k] = v;
  }

  return (
    <>
      <UserFilter users={users} />
      <SearchBar />
      <StatsBar stats={stats} />
      <CostBar stats={stats} />
      <ToolUsageBar tools={stats.tool_usage} />
      <ProjectList projects={projects} />
      <div className="panel">
        <div className="panel-header">
          <span>DATE</span>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <ExportButton />
            <DateNav date={date} />
          </div>
        </div>
      </div>
      <SessionTimeline sessions={sessions} promptMap={promptMap} date={date} />
      <PaginatedSessionTable
        initialSessions={sessions}
        user={user}
        hasMore={sessions.length < total}
      />
    </>
  );
}
