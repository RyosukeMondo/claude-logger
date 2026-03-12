import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getSession } from "@/lib/sessions";
import { getEvents } from "@/lib/events";
import type { SessionView } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pool = await getPool();
  const session = await getSession(pool, id);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const view: SessionView = {
    screen: "session",
    session,
    events: await getEvents(pool, id),
  };

  return NextResponse.json(view);
}
