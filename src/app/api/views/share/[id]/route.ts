import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/sessions";
import { getEvents } from "@/lib/events";
import { getShare } from "@/lib/shares";
import type { ShareView } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const share = getShare(db, id);

  if (!share) {
    return NextResponse.json(
      { error: "Share not found or expired" },
      { status: 404 }
    );
  }

  const session = getSession(db, share.session_id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const view: ShareView = {
    screen: "share",
    share,
    session,
    events: getEvents(db, share.session_id),
  };

  return NextResponse.json(view);
}
