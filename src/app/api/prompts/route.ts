import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { listPrompts } from "@/lib/prompts";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pool = await getPool();
  const result = await listPrompts(pool, {
    username: url.searchParams.get("user") ?? undefined,
    project: url.searchParams.get("project") ?? undefined,
    dateFrom: url.searchParams.get("date_from") ?? undefined,
    dateTo: url.searchParams.get("date_to") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
    limit: Number(url.searchParams.get("limit") ?? 50),
    offset: Number(url.searchParams.get("offset") ?? 0),
  });
  return NextResponse.json(result);
}
