import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Edge-compatible structured JSON logger (cannot import Node.js logger in Edge runtime)
function edgeLog(
  severity: string,
  message: string,
  extra?: Record<string, unknown>
) {
  console.log(
    JSON.stringify({
      severity,
      timestamp: new Date().toISOString(),
      message,
      ...extra,
    })
  );
}

// Simple middleware that checks for the session token cookie.
// Full auth validation happens in the API routes themselves.
// This avoids importing Node.js modules (bcryptjs, pg) in Edge runtime.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = crypto.randomUUID();
  const token =
    request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value;

  if (!token) {
    // Allow API key auth through without redirect
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer eul_")) {
      edgeLog("INFO", "middleware pass (api-key)", {
        method: request.method,
        path: pathname,
        requestId,
      });
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-request-id", requestId);
      const response = NextResponse.next({ request: { headers: requestHeaders } });
      response.headers.set("x-request-id", requestId);
      return response;
    }

    edgeLog("INFO", "middleware redirect", {
      method: request.method,
      path: pathname,
      requestId,
      reason: "no session cookie",
    });
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  edgeLog("INFO", "middleware pass", {
    method: request.method,
    path: pathname,
    requestId,
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: [
    "/",
    "/editor/:path*",
    "/admin/:path*",
    "/api/diagrams/:path*",
    "/api/folders/:path*",
    "/api/ai/:path*",
    "/api/shares/:path*",
    "/api/admin/:path*",
    "/api/chat-sessions/:path*",
    "/api/api-keys/:path*",
    "/api/me",
    "/api/users/:path*",
  ],
};
