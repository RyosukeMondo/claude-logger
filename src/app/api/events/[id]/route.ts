import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { deleteEvent } from "@/lib/events";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const eventId = Number(id);
  if (!Number.isFinite(eventId)) {
    return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
  }

  const pool = await getPool();
  const deleted = await deleteEvent(pool, eventId);
  if (!deleted) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
