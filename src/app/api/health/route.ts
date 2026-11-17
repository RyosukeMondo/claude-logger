import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getHealthStatus } from "@/lib/queue";

export async function GET() {
  const pool = await getPool();
  const health = await getHealthStatus(pool);

  const status = health.status === "down" ? 503 : 200;
  return NextResponse.json(health, { status });
}
