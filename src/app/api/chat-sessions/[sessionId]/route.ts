import { NextResponse } from "next/server";
import {
  getChatSession,
  listChatMessages,
  deleteChatSession,
  updateChatSessionTitle,
} from "@/lib/db";
import { getRequiredUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const log = logger.apiRequest("GET", `/api/chat-sessions/${sessionId}`);
  try {
    const user = await getRequiredUser();
    if (!user) {
      log.done(401, "unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await getChatSession(sessionId);
    if (!session) {
      log.done(404, "not found");
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (session.userId !== user.id) {
      log.done(403, "forbidden");
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const messages = await listChatMessages(sessionId);
    log.done(200, `loaded session with ${messages.length} messages`, { userId: user.id });
    return NextResponse.json({ ...session, messages });
  } catch (err) {
    log.fail(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const log = logger.apiRequest("PUT", `/api/chat-sessions/${sessionId}`);
  try {
    const user = await getRequiredUser();
    if (!user) {
      log.done(401, "unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await getChatSession(sessionId);
    if (!session) {
      log.done(404, "not found");
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (session.userId !== user.id) {
      log.done(403, "forbidden");
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    if (body.title !== undefined) {
      await updateChatSessionTitle(sessionId, body.title);
    }

    const updated = await getChatSession(sessionId);
    log.done(200, "updated session", { userId: user.id });
    return NextResponse.json(updated);
  } catch (err) {
    log.fail(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const log = logger.apiRequest("DELETE", `/api/chat-sessions/${sessionId}`);
  try {
    const user = await getRequiredUser();
    if (!user) {
      log.done(401, "unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await getChatSession(sessionId);
    if (!session) {
      log.done(404, "not found");
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (session.userId !== user.id) {
      log.done(403, "forbidden");
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await deleteChatSession(sessionId);
    log.done(200, "deleted session", { userId: user.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.fail(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
