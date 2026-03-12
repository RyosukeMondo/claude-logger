import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { listUsers } from "@/lib/sessions";

export async function GET() {
  const pool = await getPool();
  return NextResponse.json(await listUsers(pool));
}
