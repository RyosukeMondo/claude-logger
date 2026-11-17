import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getAuthContext, isAuthEnabled, listApiKeys, createApiKey, deleteApiKey } from "@/lib/auth";

export async function GET(request: Request) {
  const pool = await getPool();

  if (isAuthEnabled()) {
    const auth = await getAuthContext(request, pool);
    if (!auth || auth.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
  }

  const keys = await listApiKeys(pool);
  return NextResponse.json(keys);
}

export async function POST(request: Request) {
  const pool = await getPool();

  if (isAuthEnabled()) {
    const auth = await getAuthContext(request, pool);
    if (!auth || auth.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
  }

  const { username, role, label } = (await request.json()) as {
    username: string;
    role?: "admin" | "viewer";
    label?: string;
  };

  if (!username) {
    return NextResponse.json({ error: "username required" }, { status: 400 });
  }

  const result = await createApiKey(pool, username, role ?? "viewer", label ?? "");
  return NextResponse.json(result, { status: 201 });
}

export async function DELETE(request: Request) {
  const pool = await getPool();

  if (isAuthEnabled()) {
    const auth = await getAuthContext(request, pool);
    if (!auth || auth.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
  }

  const { id } = (await request.json()) as { id: number };
  const deleted = await deleteApiKey(pool, id);
  return NextResponse.json({ deleted });
}
