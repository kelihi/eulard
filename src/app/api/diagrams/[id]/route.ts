import { NextResponse } from "next/server";
import { z } from "zod";
import { getDiagram, updateDiagram, deleteDiagram, canAccessDiagram } from "@/lib/db";
import { getRequiredUser } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequiredUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const access = await canAccessDiagram(id, user.id);

  if (!access.access) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const diagram = await getDiagram(id);
  return NextResponse.json({ ...diagram, permission: access.permission });
}

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  code: z.string().max(50000).optional(),
  positions: z.string().max(100000).optional(),
  folderId: z.string().nullable().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequiredUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const access = await canAccessDiagram(id, user.id);

  if (!access.access) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (access.permission === "view") {
    return NextResponse.json({ error: "View-only access" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const diagram = await updateDiagram(id, parsed.data);
  return NextResponse.json(diagram);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequiredUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const diagram = await getDiagram(id);

  if (!diagram || diagram.userId !== user.id) {
    return NextResponse.json({ error: "Not found or not owner" }, { status: 404 });
  }

  await deleteDiagram(id);
  return NextResponse.json({ ok: true });
}
