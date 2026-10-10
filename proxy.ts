import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { AUTH_COOKIE } from "@/features/auth/constants";

// Dashboard had no server-side guard at all: every /dashboard/** page relied
// on its own page component calling getCurrentUser(), and several pages
// (pos, expenses, blog, reports, most settings subpages) never did — an
// unauthenticated visitor could load those page shells directly. Proxy runs
// before any route renders, so this closes that gap in one place instead of
// per-page.
//
// This only checks "is there a validly-signed, non-expired session token" —
// it does not look up the user or their module permissions (that would mean
// a DB round trip on every dashboard navigation). Per-module access (can a
// MODERATOR see /dashboard/settings, etc.) stays enforced where it already
// was: in each page component and in the API route guards.
export function proxy(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE)?.value;

  if (!token || !isValidToken(token)) {
    return NextResponse.redirect(new URL("/signin", request.url));
  }

  return NextResponse.next();
}

function isValidToken(token: string): boolean {
  try {
    jwt.verify(token, process.env.JWT_SECRET!);
    return true;
  } catch {
    return false;
  }
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
