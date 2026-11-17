import { getPool } from "@/lib/db";
import { listUsers } from "@/lib/sessions";
import { listProjects } from "@/lib/projects";
import { listPrompts } from "@/lib/prompts";
import UserFilter from "@/components/UserFilter";
import PromptExplorer from "@/components/PromptExplorer";

export const dynamic = "force-dynamic";

export default async function PromptsPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; project?: string; search?: string }>;
}) {
  const { user, project, search } = await searchParams;
  const pool = await getPool();
  const [users, projects, data] = await Promise.all([
    listUsers(pool),
    listProjects(pool, user),
    listPrompts(pool, {
      username: user,
      project,
      search,
      limit: 50,
      offset: 0,
    }),
  ]);

  return (
    <>
      <UserFilter users={users} />
      <PromptExplorer
        key={`${user ?? ""}-${project ?? ""}-${search ?? ""}`}
        initialPrompts={data.prompts}
        initialTotal={data.total}
        projects={projects.map((p) => p.project_name)}
        currentUser={user}
        currentProject={project}
        currentSearch={search}
      />
    </>
  );
}
