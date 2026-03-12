import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getStats } from "@/lib/sessions";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const user = url.searchParams.get("user") ?? undefined;

  const db = getDb();
  return NextResponse.json(getStats(db, user));
}
