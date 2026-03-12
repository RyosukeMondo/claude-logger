import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getSession } from "@/lib/sessions";
import { getEvents } from "@/lib/events";
import { getShare } from "@/lib/shares";
import type { ShareView } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pool = await getPool();
  const share = await getShare(pool, id);

  if (!share) {
    return NextResponse.json(
      { error: "Share not found or expired" },
      { status: 404 }
    );
  }

  const session = await getSession(pool, share.session_id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const view: ShareView = {
    screen: "share",
    share,
    session,
    events: await getEvents(pool, share.session_id),
  };

  return NextResponse.json(view);
}
