import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { recordEvent } from "@/lib/events";
import { enqueue } from "@/lib/queue";
import type { HookEvent } from "@/lib/types";

export async function POST(request: Request) {
  let body: HookEvent;
  try {
    body = (await request.json()) as HookEvent;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body.session_id || !body.hook_event_name) {
    return NextResponse.json(
      { error: "session_id and hook_event_name are required" },
      { status: 400 }
    );
  }

  const pool = await getPool();

  try {
    const eventId = await recordEvent(pool, body);
    return NextResponse.json({ status: "ok", event_id: eventId });
  } catch (e) {
    // If recording fails (e.g. transient DB issue), queue for retry
    try {
      const queueId = await enqueue(pool, body, String(e));
      return NextResponse.json(
        { status: "queued", queue_id: queueId },
        { status: 202 }
      );
    } catch {
      // If even queuing fails, return error
      return NextResponse.json(
        { error: "Failed to record event", detail: String(e) },
        { status: 500 }
      );
    }
  }
}
