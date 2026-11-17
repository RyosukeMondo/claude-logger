import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getDailyTrends, getToolTrends, getActiveHoursHeatmap } from "@/lib/analytics";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const user = url.searchParams.get("user") ?? undefined;
  const days = Number(url.searchParams.get("days") ?? 30);

  const pool = await getPool();
  const [trends, toolTrends, heatmap] = await Promise.all([
    getDailyTrends(pool, { username: user, days }),
    getToolTrends(pool, { username: user, days }),
    getActiveHoursHeatmap(pool, { username: user, days }),
  ]);

  return NextResponse.json({ trends, toolTrends, heatmap });
}
