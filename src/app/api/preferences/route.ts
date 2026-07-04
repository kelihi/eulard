import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getUserPreference, setUserPreference } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  const log = logger.apiRequest("GET", "/api/preferences");
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      log.done(401, "unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pref = await getUserPreference(user.id);
    log.done(200, "fetched preferences", { userId: user.id });
    return NextResponse.json({
      sendMode: pref?.send_mode ?? "cmd_enter",
    });
  } catch (err) {
    log.fail(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const log = logger.apiRequest("PUT", "/api/preferences");
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      log.done(401, "unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const sendMode = body.sendMode;

    if (sendMode !== undefined && sendMode !== "cmd_enter" && sendMode !== "enter") {
      log.done(400, "invalid sendMode");
      return NextResponse.json({ error: "sendMode must be 'cmd_enter' or 'enter'" }, { status: 400 });
    }

    await setUserPreference(user.id, { sendMode });
    const pref = await getUserPreference(user.id);

    log.done(200, "updated preferences", { userId: user.id });
    return NextResponse.json({
      sendMode: pref?.send_mode ?? "cmd_enter",
    });
  } catch (err) {
    log.fail(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
