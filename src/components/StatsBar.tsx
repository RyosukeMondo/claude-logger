import type { Stats } from "@/lib/types";

export default function StatsBar({ stats }: { stats: Stats }) {
  return (
    <div className="panel">
      <div className="panel-header">
        <span>SYSTEM STATUS</span>
        <span>{stats.total_events} events recorded</span>
      </div>
      <div className="panel-body stats-bar">
        <div>
          <div className="stat-value">{stats.total_sessions}</div>
          <div className="stat-label">SESSIONS</div>
        </div>
        <div>
          <div className="stat-value">{stats.total_events}</div>
          <div className="stat-label">EVENTS</div>
        </div>
        <div>
          <div className="stat-value">{stats.tool_usage.length}</div>
          <div className="stat-label">TOOL TYPES</div>
        </div>
      </div>
    </div>
  );
}
