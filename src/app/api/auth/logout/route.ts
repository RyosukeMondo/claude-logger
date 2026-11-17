import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ status: "ok" });
  response.cookies.set("cl_session", "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
  });
  return response;
}
