import { NextResponse } from "next/server";
import { z } from "zod";
import { listDiagrams, createDiagram } from "@/lib/db";
import { getRequiredUser } from "@/lib/auth";
import { generateId } from "@/lib/utils";
import { logger } from "@/lib/logger";

export async function GET() {
  const log = logger.apiRequest("GET", "/api/diagrams");
  try {
    const user = await getRequiredUser();
    if (!user) {
      log.done(401, "unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const diagrams = await listDiagrams(user.id);
    log.done(200, `listed ${diagrams.length} diagrams`, { userId: user.id });
    return NextResponse.json(diagrams);
  } catch (err) {
    log.fail(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

const createSchema = z.object({
  title: z.string().min(1).max(200).optional().default("Untitled Diagram"),
  code: z
    .string()
    .max(50000)
    .optional()
    .default("flowchart TB\n    A[Start] --> B[End]"),
  folderId: z.string().optional(),
});

export async function POST(request: Request) {
  const log = logger.apiRequest("POST", "/api/diagrams");
  try {
    const user = await getRequiredUser();
    if (!user) {
      log.done(401, "unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      log.done(400, "validation error");
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const id = generateId();
    const diagram = await createDiagram(
      id,
      parsed.data.title,
      parsed.data.code,
      user.id,
      parsed.data.folderId
    );
    log.done(201, `created diagram ${id}`, { userId: user.id });
    return NextResponse.json(diagram, { status: 201 });
  } catch (err) {
    log.fail(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
