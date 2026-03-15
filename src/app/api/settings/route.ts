import { NextResponse } from "next/server";
import { getRequiredUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function GET() {
  const log = logger.apiRequest("GET", "/api/settings");
  const user = await getRequiredUser();
  if (!user) {
    log.done(401, "unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // In hosted mode, API key is set server-side via env var
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
  log.done(200, "fetched settings", { userId: user.id });
  return NextResponse.json({
    hasApiKey,
    apiKeyPreview: hasApiKey ? "Configured via server" : null,
  });
}

export async function PUT() {
  const log = logger.apiRequest("PUT", "/api/settings");
  const user = await getRequiredUser();
  if (!user) {
    log.done(401, "unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // In hosted mode, API key is managed server-side
  log.done(200, "updated settings", { userId: user.id });
  return NextResponse.json({
    hasApiKey: !!process.env.ANTHROPIC_API_KEY,
    apiKeyPreview: process.env.ANTHROPIC_API_KEY ? "Configured via server" : null,
  });
}
