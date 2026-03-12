import Link from "next/link";
import type { Session } from "@/lib/types";

export default function SessionTable({ sessions }: { sessions: Session[] }) {
  if (sessions.length === 0) {
    return (
      <div className="panel">
        <div className="panel-header">SESSIONS</div>
        <div className="panel-body empty">
          <p>NO SESSIONS RECORDED</p>
          <pre>
{` Configure Claude Code hooks to POST to:
 http://localhost:8111/api/hooks

 Waiting for events`}
            <span className="cursor" />
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <span>SESSIONS</span>
        <span>{sessions.length} loaded</span>
      </div>
      <div className="panel-body">
        <table className="tt">
          <thead>
            <tr>
              <th>SESSION ID</th>
              <th>USER</th>
              <th>PROJECT</th>
              <th>EVENTS</th>
              <th>PROMPTS</th>
              <th>TOOLS</th>
              <th>STARTED</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/sessions/${s.id}`}>
                    {s.id.slice(0, 12)}...
                  </Link>
                </td>
                <td style={{ color: "var(--cyan)" }}>{s.username || "-"}</td>
                <td>{shortPath(s.project_dir)}</td>
                <td>{s.event_count}</td>
                <td>{s.prompt_count}</td>
                <td>{s.tool_count}</td>
                <td>{s.started_at?.slice(0, 19) ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function shortPath(p: string): string {
  if (!p) return "-";
  return p.replace(/^\/home\/[^/]+/, "~");
}
