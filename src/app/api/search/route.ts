import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { searchEvents } from "@/lib/search";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const user = url.searchParams.get("user") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  if (!q.trim()) {
    return NextResponse.json({ results: [], total: 0, query: "" });
  }

  const pool = await getPool();
  const { results, total } = await searchEvents(pool, q, { username: user, limit, offset });
  return NextResponse.json({ results, total, query: q });
}
