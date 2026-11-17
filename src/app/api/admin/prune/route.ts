import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { pruneOldData, getRetentionConfig } from "@/lib/lifecycle";

export async function POST(request: Request) {
  const pool = await getPool();
  const body = (await request.json().catch(() => ({}))) as { max_age_days?: number };

  const config = await getRetentionConfig(pool);
  const maxAgeDays = body.max_age_days ?? config.max_age_days;

  const result = await pruneOldData(pool, maxAgeDays);

  // Update last pruned timestamp
  await pool.query(
    "UPDATE retention_config SET last_pruned_at = NOW() WHERE id = 1"
  );

  return NextResponse.json(result);
}
