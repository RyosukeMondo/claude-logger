import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getStats } from "@/lib/sessions";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const user = url.searchParams.get("user") ?? undefined;

  const pool = await getPool();
  return NextResponse.json(await getStats(pool, user));
}
