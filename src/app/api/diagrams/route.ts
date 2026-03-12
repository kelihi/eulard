import { NextResponse } from "next/server";
import { z } from "zod";
import { listDiagrams, createDiagram } from "@/lib/db";
import { generateId } from "@/lib/utils";

export async function GET() {
  const diagrams = listDiagrams();
  return NextResponse.json(diagrams);
}

const createSchema = z.object({
  title: z.string().min(1).max(200).optional().default("Untitled Diagram"),
  code: z
    .string()
    .max(50000)
    .optional()
    .default("flowchart TB\n    A[Start] --> B[End]"),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const id = generateId();
  const diagram = createDiagram(id, parsed.data.title, parsed.data.code);
  return NextResponse.json(diagram, { status: 201 });
}
