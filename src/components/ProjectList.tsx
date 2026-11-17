import type { ProjectSummary } from "@/lib/types";

export default function ProjectList({ projects }: { projects: ProjectSummary[] }) {
  if (projects.length === 0) return null;

  return (
    <div className="panel">
      <div className="panel-header">
        <span>PROJECTS</span>
        <span>{projects.length} projects</span>
      </div>
      <div className="panel-body">
        <table className="tt">
          <thead>
            <tr>
              <th>PROJECT</th>
              <th>SESSIONS</th>
              <th>EVENTS</th>
              <th>PROMPTS</th>
              <th>TOOLS</th>
              <th>COST</th>
              <th>LAST ACTIVITY</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.project_name}>
                <td style={{ color: "var(--cyan)" }}>{p.project_name}</td>
                <td>{p.session_count}</td>
                <td>{p.event_count}</td>
                <td>{p.prompt_count}</td>
                <td>{p.tool_count}</td>
                <td style={{ color: "var(--amber)" }}>
                  {p.total_cost_usd > 0 ? `$${p.total_cost_usd.toFixed(4)}` : "-"}
                </td>
                <td>{p.last_activity?.slice(0, 19) ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
