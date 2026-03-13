import { NextResponse } from "next/server";
import { z } from "zod";
import { getDiagram, updateDiagram, deleteDiagram } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const diagram = getDiagram(id);

  if (!diagram) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(diagram);
}

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  code: z.string().max(50000).optional(),
  positions: z.string().max(100000).optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = getDiagram(id);

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const diagram = updateDiagram(id, parsed.data);
  return NextResponse.json(diagram);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  deleteDiagram(id);
  return NextResponse.json({ ok: true });
}
