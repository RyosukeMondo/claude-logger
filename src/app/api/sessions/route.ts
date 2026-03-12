import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { listSessions } from "@/lib/sessions";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const user = url.searchParams.get("user") ?? undefined;

  const db = getDb();
  return NextResponse.json(listSessions(db, limit, offset, user));
}
