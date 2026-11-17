import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getAggregateCosts } from "@/lib/costs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const user = url.searchParams.get("user") ?? undefined;
  const since = url.searchParams.get("since") ?? undefined;

  const pool = await getPool();
  const costs = await getAggregateCosts(pool, { username: user, since });
  return NextResponse.json(costs);
}
