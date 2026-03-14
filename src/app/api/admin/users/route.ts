import { NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import { requireAdmin } from "@/lib/auth";
import { listUsers, createUser, deleteUser, getUserByEmail } from "@/lib/db";
import { generateId } from "@/lib/utils";
import { logger } from "@/lib/logger";

export async function GET() {
  const log = logger.apiRequest("GET", "/api/admin/users");
  const admin = await requireAdmin();
  if (!admin) {
    log.done(403, "forbidden");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await listUsers();
  log.done(200, `listed ${users.length} users`, { userId: admin.id });
  return NextResponse.json(users);
}

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200).optional().default(""),
  password: z.string().min(6).max(200),
});

export async function POST(request: Request) {
  const log = logger.apiRequest("POST", "/api/admin/users");
  const admin = await requireAdmin();
  if (!admin) {
    log.done(403, "forbidden");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = inviteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const existing = await getUserByEmail(parsed.data.email);
  if (existing) {
    return NextResponse.json({ error: "User with this email already exists" }, { status: 409 });
  }

  const passwordHash = await hash(parsed.data.password, 12);
  const user = await createUser(
    generateId(),
    parsed.data.email,
    parsed.data.name,
    passwordHash
  );

  log.done(201, `created user ${parsed.data.email}`, { userId: admin.id });
  return NextResponse.json(user, { status: 201 });
}

export async function DELETE(request: Request) {
  const log = logger.apiRequest("DELETE", "/api/admin/users");
  const admin = await requireAdmin();
  if (!admin) {
    log.done(403, "forbidden");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  }

  if (id === admin.id) {
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
  }

  await deleteUser(id);
  log.done(200, `deleted user ${id}`, { userId: admin.id });
  return NextResponse.json({ ok: true });
}
