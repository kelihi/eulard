import { NextResponse } from "next/server";
import { listChatSessions, createChatSession, canAccessDiagram } from "@/lib/db";
import { getRequiredUser } from "@/lib/auth";
import { generateId } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { z } from "zod";

export async function GET(request: Request) {
  const log = logger.apiRequest("GET", "/api/chat-sessions");
  try {
    const user = await getRequiredUser();
    if (!user) {
      log.done(401, "unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const diagramId = searchParams.get("diagramId");
    if (!diagramId) {
      log.done(400, "missing diagramId");
      return NextResponse.json({ error: "diagramId is required" }, { status: 400 });
    }

    const access = await canAccessDiagram(diagramId, user.id);
    if (!access.access) {
      log.done(403, "forbidden");
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const sessions = await listChatSessions(diagramId, user.id);
    log.done(200, `listed ${sessions.length} chat sessions`, { userId: user.id });
    return NextResponse.json(sessions);
  } catch (err) {
    log.fail(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

const createSchema = z.object({
  diagramId: z.string().min(1),
  title: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  const log = logger.apiRequest("POST", "/api/chat-sessions");
  try {
    const user = await getRequiredUser();
    if (!user) {
      log.done(401, "unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      log.done(400, "validation error");
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const access = await canAccessDiagram(parsed.data.diagramId, user.id);
    if (!access.access) {
      log.done(403, "forbidden");
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const id = generateId();
    const session = await createChatSession(id, parsed.data.diagramId, user.id, parsed.data.title);
    log.done(201, `created chat session ${id}`, { userId: user.id });
    return NextResponse.json(session, { status: 201 });
  } catch (err) {
    log.fail(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
