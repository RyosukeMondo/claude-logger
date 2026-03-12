import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { listUsers, listSessions, getStats } from "@/lib/sessions";
import type { DashboardView } from "@/lib/types";

export async function GET(request: Request): Promise<NextResponse<DashboardView>> {
  const url = new URL(request.url);
  const user = url.searchParams.get("user") ?? undefined;

  const db = getDb();
  return NextResponse.json({
    screen: "dashboard",
    users: listUsers(db),
    current_user: user ?? null,
    stats: getStats(db, user),
    sessions: listSessions(db, 50, 0, user),
  });
}
