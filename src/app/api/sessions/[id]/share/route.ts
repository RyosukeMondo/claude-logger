import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/sessions";
import { createShare } from "@/lib/shares";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const session = getSession(db, id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const days = Number(url.searchParams.get("days") ?? 7);
  const share = createShare(db, id, days);
  const base = new URL(request.url).origin;
  return NextResponse.json({ ...share, url: `${base}/share/${share.id}` });
}
