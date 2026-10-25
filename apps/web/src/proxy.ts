// Optimistic UX redirects only: no DB call, no real auth. getSessionCookie only checks that a session
// cookie exists, not that it's valid. Enforcement lives in requireSession() and getSession()
// (src/lib/session.ts), which every page, route handler and action calls itself.
// /login and /register are deliberately not redirected away on a cookie: a stale cookie (DB reset,
// expired or revoked session) would loop /login -> /dashboard (proxy) -> /login (requireSession).
// The / page does the real getSession() redirect instead.
import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*", "/results/:path*", "/profile/:path*"] };
