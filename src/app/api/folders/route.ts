import { NextResponse } from "next/server";
import { z } from "zod";
import { listFolders, createFolder, updateFolder, deleteFolder } from "@/lib/db";
import { getRequiredUser } from "@/lib/auth";
import { generateId } from "@/lib/utils";

export async function GET() {
  const user = await getRequiredUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const folders = await listFolders(user.id);
  return NextResponse.json(folders);
}

const createSchema = z.object({
  name: z.string().min(1).max(200).optional().default("New Folder"),
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
  const folder = await createFolder(id, parsed.data.name, user.id);
  return NextResponse.json(folder, { status: 201 });
}

const updateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
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

  await updateFolder(parsed.data.id, parsed.data.name, user.id);
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
