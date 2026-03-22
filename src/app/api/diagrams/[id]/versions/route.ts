import { NextResponse } from "next/server";
import { canAccessDiagram, listDiagramVersions, createDiagramVersion, clearDiagramVersions } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const requestId = _request.headers.get("x-request-id") ?? undefined;
  const log = logger.apiRequest("GET", `/api/diagrams/${id}/versions`, { requestId });
  try {
    const user = await authenticateRequest(_request);
    if (!user) {
      log.done(401, "unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await canAccessDiagram(id, user.id, user.email);
    if (!access.access) {
      log.done(404, "not found or no access", { userId: user.id });
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const versions = await listDiagramVersions(id);
    log.done(200, "fetched versions", { userId: user.id, count: versions.length });
    return NextResponse.json(versions);
  } catch (err) {
    log.fail(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const requestId = request.headers.get("x-request-id") ?? undefined;
  const log = logger.apiRequest("POST", `/api/diagrams/${id}/versions`, { requestId });
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      log.done(401, "unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await canAccessDiagram(id, user.id, user.email);
    if (!access.access || access.permission === "view") {
      log.done(403, "no write access", { userId: user.id });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { patches, source } = body as {
      patches: Array<{ patch: unknown; inversePatch: unknown }>;
      source?: string;
    };

    if (!Array.isArray(patches) || patches.length === 0) {
      log.done(400, "invalid patches");
      return NextResponse.json({ error: "patches array required" }, { status: 400 });
    }

    for (const { patch, inversePatch } of patches) {
      await createDiagramVersion(id, patch, inversePatch, source ?? "user");
    }

    log.done(200, "saved versions", { userId: user.id, count: patches.length });
    return NextResponse.json({ ok: true });
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
  const log = logger.apiRequest("DELETE", `/api/diagrams/${id}/versions`, { requestId });
  try {
    const user = await authenticateRequest(_request);
    if (!user) {
      log.done(401, "unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await canAccessDiagram(id, user.id, user.email);
    if (!access.access || access.permission === "view") {
      log.done(403, "no write access", { userId: user.id });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await clearDiagramVersions(id);
    log.done(200, "cleared versions", { userId: user.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.fail(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
