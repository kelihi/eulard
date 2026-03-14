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

const shareSchema = z.object({
  diagramId: z.string(),
  email: z.string().email(),
  permission: z.enum(["view", "edit"]).optional().default("view"),
});

export async function GET(request: Request) {
  const user = await getRequiredUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const diagramId = searchParams.get("diagramId");

  if (!diagramId) {
    return NextResponse.json({ error: "Missing diagramId" }, { status: 400 });
  }

  const diagram = await getDiagram(diagramId);
  if (!diagram || diagram.userId !== user.id) {
    return NextResponse.json({ error: "Not found or not owner" }, { status: 404 });
  }

  const shares = await listDiagramShares(diagramId);
  return NextResponse.json(shares);
}

export async function POST(request: Request) {
  const user = await getRequiredUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = shareSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const diagram = await getDiagram(parsed.data.diagramId);
  if (!diagram || diagram.userId !== user.id) {
    return NextResponse.json({ error: "Not found or not owner" }, { status: 404 });
  }

  const targetUser = await getUserByEmail(parsed.data.email);
  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (targetUser.id === user.id) {
    return NextResponse.json({ error: "Cannot share with yourself" }, { status: 400 });
  }

  await shareDiagram(
    generateId(),
    parsed.data.diagramId,
    targetUser.id,
    parsed.data.permission
  );

  const shares = await listDiagramShares(parsed.data.diagramId);
  return NextResponse.json(shares, { status: 201 });
}

const removeSchema = z.object({
  diagramId: z.string(),
  userId: z.string(),
});

export async function DELETE(request: Request) {
  const user = await getRequiredUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = removeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const diagram = await getDiagram(parsed.data.diagramId);
  if (!diagram || diagram.userId !== user.id) {
    return NextResponse.json({ error: "Not found or not owner" }, { status: 404 });
  }

  await removeDiagramShare(parsed.data.diagramId, parsed.data.userId);
  return NextResponse.json({ ok: true });
}
