import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { listProjects } from "@/lib/projects";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const user = url.searchParams.get("user") ?? undefined;

  const pool = await getPool();
  const projects = await listProjects(pool, user);
  return NextResponse.json(projects);
}
