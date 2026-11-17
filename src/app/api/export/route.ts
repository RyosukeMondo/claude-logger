import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { exportSessionsCsv, exportSessionsJson } from "@/lib/lifecycle";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "json";
  const user = url.searchParams.get("user") ?? undefined;
  const since = url.searchParams.get("since") ?? undefined;
  const until = url.searchParams.get("until") ?? undefined;

  const pool = await getPool();

  if (format === "csv") {
    const csv = await exportSessionsCsv(pool, { username: user, since, until });
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="claude-logger-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  const data = await exportSessionsJson(pool, { username: user, since, until });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="claude-logger-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
