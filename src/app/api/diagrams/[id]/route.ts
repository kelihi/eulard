import { NextResponse } from "next/server";
import { z } from "zod";
import { getDiagram, updateDiagram, deleteDiagram, canAccessDiagram } from "@/lib/db";
import { getRequiredUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const requestId = _request.headers.get("x-request-id") ?? undefined;
  const log = logger.apiRequest("GET", `/api/diagrams/${id}`, { requestId });
  try {
    const user = await getRequiredUser();
    if (!user) {
      log.done(401, "unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await canAccessDiagram(id, user.id);

    if (!access.access) {
      log.done(404, "not found or no access", { userId: user.id });
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const diagram = await getDiagram(id);
    log.done(200, "fetched diagram", { userId: user.id });
    return NextResponse.json({ ...diagram, permission: access.permission });
  } catch (err) {
    log.fail(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  code: z.string().max(50000).optional(),
  positions: z.string().max(100000).nullable().optional(),
  folderId: z.string().nullable().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const requestId = request.headers.get("x-request-id") ?? undefined;
  const log = logger.apiRequest("PUT", `/api/diagrams/${id}`, { requestId });
  try {
    const user = await getRequiredUser();
    if (!user) {
      log.done(401, "unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await canAccessDiagram(id, user.id);

    if (!access.access) {
      log.done(404, "not found or no access", { userId: user.id });
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (access.permission === "view") {
      log.done(403, "view-only access", { userId: user.id });
      return NextResponse.json({ error: "View-only access" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      log.done(400, "validation error", { error: parsed.error.message });
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const diagram = await updateDiagram(id, parsed.data);
    log.done(200, "updated diagram", { userId: user.id });
    return NextResponse.json(diagram);
  } catch (err) {
    log.fail(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const requestId = _request.headers.get("x-request-id") ?? undefined;
  const log = logger.apiRequest("DELETE", `/api/diagrams/${id}`, { requestId });
  try {
    const user = await getRequiredUser();
    if (!user) {
      log.done(401, "unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const diagram = await getDiagram(id);

    if (!diagram || diagram.userId !== user.id) {
      log.done(404, "not found or not owner", { userId: user.id });
      return NextResponse.json({ error: "Not found or not owner" }, { status: 404 });
    }

    await deleteDiagram(id);
    log.done(200, "deleted diagram", { userId: user.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.fail(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
