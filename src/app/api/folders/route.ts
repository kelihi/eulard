import { NextResponse } from "next/server";
import { z } from "zod";
import { listFolders, createFolder, updateFolder, deleteFolder } from "@/lib/db";
import { getRequiredUser } from "@/lib/auth";
import { generateId } from "@/lib/utils";
import { logger } from "@/lib/logger";

export async function GET() {
  const log = logger.apiRequest("GET", "/api/folders");
  try {
    const user = await getRequiredUser();
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
  clientId: z.string().optional(),
});

export async function POST(request: Request) {
  const user = await getRequiredUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const id = generateId();
  const folder = await createFolder(id, parsed.data.name, user.id, parsed.data.clientId);
  return NextResponse.json(folder, { status: 201 });
}

const updateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200).optional(),
  clientId: z.string().nullable().optional(),
});

export async function PUT(request: Request) {
  const user = await getRequiredUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  await updateFolder(parsed.data.id, { name: parsed.data.name, clientId: parsed.data.clientId }, user.id);
  return NextResponse.json({ ok: true });
}

const deleteSchema = z.object({
  id: z.string(),
});

export async function DELETE(request: Request) {
  const user = await getRequiredUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = deleteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  await deleteFolder(parsed.data.id, user.id);
  return NextResponse.json({ ok: true });
}
