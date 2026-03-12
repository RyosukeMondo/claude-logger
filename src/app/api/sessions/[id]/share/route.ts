import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getSession } from "@/lib/sessions";
import { createShare } from "@/lib/shares";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pool = await getPool();

  const session = await getSession(pool, id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const days = Number(url.searchParams.get("days") ?? 7);
  const share = await createShare(pool, id, days);
  const base = new URL(request.url).origin;
  return NextResponse.json({ ...share, url: `${base}/share/${share.id}` });
}
