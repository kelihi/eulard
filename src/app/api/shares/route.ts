import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequiredUser } from "@/lib/auth";
import {
  getDiagram,
  getUserByEmail,
  listDiagramShares,
  shareDiagram,
  removeDiagramShare,
} from "@/lib/db";
import { generateId } from "@/lib/utils";
import { logger } from "@/lib/logger";

const shareSchema = z.object({
  diagramId: z.string(),
  email: z.string().email(),
  permission: z.enum(["view", "edit"]).optional().default("view"),
});

export async function GET(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? undefined;
  const log = logger.apiRequest("GET", "/api/shares", { requestId });
  try {
    const user = await getRequiredUser();
    if (!user) {
      log.done(401, "unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const diagramId = searchParams.get("diagramId");

    if (!diagramId) {
      log.done(400, "missing diagramId", { userId: user.id });
      return NextResponse.json({ error: "Missing diagramId" }, { status: 400 });
    }

    const diagram = await getDiagram(diagramId);
    if (!diagram || diagram.userId !== user.id) {
      log.done(404, "not found or not owner", { userId: user.id });
      return NextResponse.json({ error: "Not found or not owner" }, { status: 404 });
    }

    const shares = await listDiagramShares(diagramId);
    log.done(200, `listed ${shares.length} shares`, { userId: user.id });
    return NextResponse.json(shares);
  } catch (err) {
    log.fail(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? undefined;
  const log = logger.apiRequest("POST", "/api/shares", { requestId });
  try {
    const user = await getRequiredUser();
    if (!user) {
      log.done(401, "unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = shareSchema.safeParse(body);

    if (!parsed.success) {
      log.done(400, "validation error", { userId: user.id });
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const diagram = await getDiagram(parsed.data.diagramId);
    if (!diagram || diagram.userId !== user.id) {
      log.done(404, "not found or not owner", { userId: user.id });
      return NextResponse.json({ error: "Not found or not owner" }, { status: 404 });
    }

    const targetUser = await getUserByEmail(parsed.data.email);
    if (!targetUser) {
      log.done(404, "target user not found", { userId: user.id });
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (targetUser.id === user.id) {
      log.done(400, "cannot share with self", { userId: user.id });
      return NextResponse.json({ error: "Cannot share with yourself" }, { status: 400 });
    }

    await shareDiagram(
      generateId(),
      parsed.data.diagramId,
      targetUser.id,
      parsed.data.permission
    );

    const shares = await listDiagramShares(parsed.data.diagramId);
    log.done(201, "shared diagram", { userId: user.id });
    return NextResponse.json(shares, { status: 201 });
  } catch (err) {
    log.fail(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

const removeSchema = z.object({
  diagramId: z.string(),
  userId: z.string(),
});

export async function DELETE(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? undefined;
  const log = logger.apiRequest("DELETE", "/api/shares", { requestId });
  try {
    const user = await getRequiredUser();
    if (!user) {
      log.done(401, "unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = removeSchema.safeParse(body);

    if (!parsed.success) {
      log.done(400, "validation error", { userId: user.id });
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const diagram = await getDiagram(parsed.data.diagramId);
    if (!diagram || diagram.userId !== user.id) {
      log.done(404, "not found or not owner", { userId: user.id });
      return NextResponse.json({ error: "Not found or not owner" }, { status: 404 });
    }

    await removeDiagramShare(parsed.data.diagramId, parsed.data.userId);
    log.done(200, "removed share", { userId: user.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.fail(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
