import { NextResponse } from "next/server";
import { z } from "zod";
import { listFolders, createFolder, updateFolder, deleteFolder } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import { generateId } from "@/lib/utils";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  const log = logger.apiRequest("GET", "/api/folders");
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      log.done(401, "unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const folders = await listFolders(user.id);
    log.done(200, `listed ${folders.length} folders`, { userId: user.id });
    return NextResponse.json(folders);
  } catch (err) {
    log.fail(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(200).optional().default("New Folder"),
});

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? undefined;
  const log = logger.apiRequest("POST", "/api/folders", { requestId });
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      log.done(401, "unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      log.done(400, "validation error", { userId: user.id });
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const id = generateId();
    const folder = await createFolder(id, parsed.data.name, user.id);
    log.done(201, `created folder ${id}`, { userId: user.id });
    return NextResponse.json(folder, { status: 201 });
  } catch (err) {
    log.fail(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

const updateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
});

export async function PUT(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? undefined;
  const log = logger.apiRequest("PUT", "/api/folders", { requestId });
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      log.done(401, "unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      log.done(400, "validation error", { userId: user.id });
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    await updateFolder(parsed.data.id, parsed.data.name, user.id);
    log.done(200, "updated folder", { userId: user.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.fail(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

const deleteSchema = z.object({
  id: z.string(),
});

export async function DELETE(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? undefined;
  const log = logger.apiRequest("DELETE", "/api/folders", { requestId });
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      log.done(401, "unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);

    if (!parsed.success) {
      log.done(400, "validation error", { userId: user.id });
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    await deleteFolder(parsed.data.id, user.id);
    log.done(200, "deleted folder", { userId: user.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.fail(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
