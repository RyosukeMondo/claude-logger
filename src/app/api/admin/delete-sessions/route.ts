import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { bulkDeleteSessions } from "@/lib/lifecycle";

export async function POST(request: Request) {
  const { session_ids } = (await request.json()) as { session_ids: string[] };

  if (!Array.isArray(session_ids) || session_ids.length === 0) {
    return NextResponse.json({ error: "session_ids array required" }, { status: 400 });
  }

  const pool = await getPool();
  const deleted = await bulkDeleteSessions(pool, session_ids);
  return NextResponse.json({ deleted });
}
