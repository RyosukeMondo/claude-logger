import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { recordEvent } from "@/lib/events";
import type { HookEvent } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json()) as HookEvent;

  if (!body.session_id || !body.hook_event_name) {
    return NextResponse.json(
      { error: "session_id and hook_event_name are required" },
      { status: 400 }
    );
  }

  const db = getDb();
  const eventId = recordEvent(db, body);
  return NextResponse.json({ status: "ok", event_id: eventId });
}
