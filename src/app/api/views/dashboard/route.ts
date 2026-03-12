import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { listUsers, listSessions, getStats } from "@/lib/sessions";
import type { DashboardView } from "@/lib/types";

export async function GET(request: Request): Promise<NextResponse<DashboardView>> {
  const url = new URL(request.url);
  const user = url.searchParams.get("user") ?? undefined;

  const pool = await getPool();
  return NextResponse.json({
    screen: "dashboard",
    users: await listUsers(pool),
    current_user: user ?? null,
    stats: await getStats(pool, user),
    sessions: await listSessions(pool, 50, 0, user),
  });
}
