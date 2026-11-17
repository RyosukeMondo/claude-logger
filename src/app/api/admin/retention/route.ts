import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getRetentionConfig, updateRetentionConfig } from "@/lib/lifecycle";

export async function GET() {
  const pool = await getPool();
  const config = await getRetentionConfig(pool);
  return NextResponse.json(config);
}

export async function PUT(request: Request) {
  const pool = await getPool();
  const body = (await request.json()) as {
    max_age_days?: number;
    auto_prune_enabled?: boolean;
  };

  await updateRetentionConfig(pool, body);
  const config = await getRetentionConfig(pool);
  return NextResponse.json(config);
}
