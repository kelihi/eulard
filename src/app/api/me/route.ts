import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  const log = logger.apiRequest("GET", "/api/me");
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      log.done(401, "unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    log.done(200, "fetched current user", { userId: user.id });
    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  } catch (err) {
    log.fail(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
