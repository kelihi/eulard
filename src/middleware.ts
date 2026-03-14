export { auth as middleware } from "@/lib/auth";

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
