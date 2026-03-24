import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getUserPreferences, setUserPreferences } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  const log = logger.apiRequest("GET", "/api/user-preferences");
  const user = await authenticateRequest(request);
  if (!user) {
    log.done(401, "unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const preferences = await getUserPreferences(user.id);
  log.done(200, "fetched user preferences", { userId: user.id });
  return NextResponse.json(preferences);
}

export async function PUT(request: Request) {
  const log = logger.apiRequest("PUT", "/api/user-preferences");
  const user = await authenticateRequest(request);
  if (!user) {
    log.done(401, "unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // Validate shortcuts if provided
  for (const key of ["sidebarToggleShortcut", "codeToggleShortcut", "chatToggleShortcut"] as const) {
    if (body[key] !== undefined) {
      const shortcut = body[key];
      if (typeof shortcut !== "string" || shortcut.length === 0 || shortcut.length > 50) {
        log.done(400, `invalid ${key}`);
        return NextResponse.json({ error: "Invalid shortcut" }, { status: 400 });
      }
    }
  }

  const updated = await setUserPreferences(user.id, body);
  log.done(200, "updated user preferences", { userId: user.id });
  return NextResponse.json(updated);
}
