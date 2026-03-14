import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Simple middleware that checks for the session token cookie.
// Full auth validation happens in the API routes themselves.
// This avoids importing Node.js modules (bcryptjs, pg) in Edge runtime.
export function middleware(request: NextRequest) {
  const token =
    request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/editor/:path*",
    "/admin/:path*",
    "/api/diagrams/:path*",
    "/api/folders/:path*",
    "/api/ai/:path*",
    "/api/shares/:path*",
    "/api/admin/:path*",
  ],
};
