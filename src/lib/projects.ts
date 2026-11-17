import type { Pool } from "pg";
import type { ProjectSummary } from "./types";
import { toLocalIso } from "./time";

/** List all projects with aggregate stats. */
export async function listProjects(
  pool: Pool,
  username?: string
): Promise<ProjectSummary[]> {
  const conditions = ["project_name != ''"];
  const params: unknown[] = [];

  if (username) {
    params.push(username);
    conditions.push(`username = $${params.length}`);
  }

  const where = conditions.join(" AND ");

  const { rows } = await pool.query(
    `SELECT
       project_name,
       MAX(project_dir) as project_dir,
       COUNT(*)::int as session_count,
       COALESCE(SUM(event_count), 0)::int as event_count,
       COALESCE(SUM(prompt_count), 0)::int as prompt_count,
       COALESCE(SUM(tool_count), 0)::int as tool_count,
       COALESCE(SUM(total_cost_usd), 0)::numeric as total_cost_usd,
       MAX(started_at) as last_activity
     FROM sessions
     WHERE ${where}
     GROUP BY project_name
     ORDER BY last_activity DESC NULLS LAST`,
    params
  );

  return rows.map((r) => ({
    project_name: r.project_name,
    project_dir: r.project_dir,
    session_count: r.session_count,
    event_count: r.event_count,
    prompt_count: r.prompt_count,
    tool_count: r.tool_count,
    total_cost_usd: Number(r.total_cost_usd),
    last_activity: r.last_activity ? toLocalIso(r.last_activity) : null,
  }));
}

/** Backfill project_name for existing sessions that have project_dir but no project_name. */
export async function backfillProjectNames(pool: Pool): Promise<number> {
  const { rowCount } = await pool.query(`
    UPDATE sessions
    SET project_name = CASE
      WHEN project_dir LIKE '%/%' THEN
        REVERSE(SPLIT_PART(REVERSE(RTRIM(project_dir, '/')), '/', 1))
      WHEN project_dir LIKE '%\\\\%' THEN
        REVERSE(SPLIT_PART(REVERSE(RTRIM(project_dir, '\\\\')), '\\\\', 1))
      ELSE project_dir
    END
    WHERE project_name = '' AND project_dir != ''
  `);
  return rowCount ?? 0;
}
