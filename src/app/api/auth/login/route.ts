import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { isAuthEnabled, validateApiKey, createSessionToken } from "@/lib/auth";

export async function POST(request: Request) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ error: "Auth is not enabled" }, { status: 400 });
  }

  const { key } = (await request.json()) as { key?: string };
  if (!key) {
    return NextResponse.json({ error: "API key required" }, { status: 400 });
  }

  const pool = await getPool();
  const auth = await validateApiKey(pool, key);
  if (!auth) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const token = createSessionToken(auth.username, auth.role);
  const response = NextResponse.json({
    username: auth.username,
    role: auth.role,
  });
  response.cookies.set("cl_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 3600,
    path: "/",
  });
  return response;
}
