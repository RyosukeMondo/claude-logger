import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Auth middleware — only active when AUTH_ENABLED=true.
 * Protects all routes except: /api/hooks, /api/health, /share/*, /login, /_next/*, /favicon.ico
 */
export function middleware(request: NextRequest) {
  const authEnabled = process.env.AUTH_ENABLED === "true";
  if (!authEnabled) return NextResponse.next();

  const { pathname } = request.nextUrl;

  // Public routes — no auth needed
  if (
    pathname.startsWith("/api/hooks") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/share/") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // API routes: check Bearer token
  if (pathname.startsWith("/api/")) {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    // Token validation happens in the route handler via getAuthContext
    return NextResponse.next();
  }

  // Page routes: check session cookie
  const sessionCookie = request.cookies.get("cl_session");
  if (!sessionCookie?.value) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
