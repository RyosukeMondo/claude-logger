import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { listUsers } from "@/lib/sessions";

export async function GET() {
  const db = getDb();
  return NextResponse.json(listUsers(db));
}
