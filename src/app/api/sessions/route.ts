import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { listSessions, countSessions } from "@/lib/sessions";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const user = url.searchParams.get("user") ?? undefined;
  const project = url.searchParams.get("project") ?? undefined;

  const pool = await getPool();
  const [sessions, total] = await Promise.all([
    listSessions(pool, limit, offset, user, project),
    countSessions(pool, user, project),
  ]);

  return NextResponse.json({
    sessions,
    total,
    hasMore: offset + sessions.length < total,
  });
}
