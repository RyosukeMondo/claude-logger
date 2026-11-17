import { getPool } from "@/lib/db";
import { listUsers } from "@/lib/sessions";
import { getDailyTrends, getActiveHoursHeatmap } from "@/lib/analytics";
import TrendChart from "@/components/TrendChart";
import Heatmap from "@/components/Heatmap";
import UserFilter from "@/components/UserFilter";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; days?: string }>;
}) {
  const { user, days: daysParam } = await searchParams;
  const days = daysParam ? Number(daysParam) : 30;

  const pool = await getPool();
  const [users, trends, heatmap] = await Promise.all([
    listUsers(pool),
    getDailyTrends(pool, { username: user, days }),
    getActiveHoursHeatmap(pool, { username: user, days }),
  ]);

  return (
    <>
      <UserFilter users={users} />

      <div className="panel">
        <div className="panel-header">
          <span>DAILY TRENDS</span>
          <span>last {days} days</span>
        </div>
        <div className="panel-body">
          <TrendChart trends={trends} />
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span>ACTIVITY HEATMAP</span>
          <span>hour × day of week</span>
        </div>
        <div className="panel-body">
          <Heatmap cells={heatmap} />
        </div>
      </div>
    </>
  );
}
