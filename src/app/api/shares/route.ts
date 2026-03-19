import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest } from "@/lib/auth";
import {
  getDiagram,
  getUserByEmail,
  createUser,
  listDiagramShares,
  shareDiagram,
  removeDiagramShare,
} from "@/lib/db";
import { generateId } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { randomBytes } from "crypto";

const shareSchema = z.object({
  diagramId: z.string(),
  email: z.string().email(),
  permission: z.enum(["view", "edit"]).optional().default("view"),
});

export async function GET(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? undefined;
  const log = logger.apiRequest("GET", "/api/shares", { requestId });
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      log.done(401, "unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const diagramId = searchParams.get("diagramId");

    if (!diagramId) {
      log.done(400, "missing diagramId", { userId: user.id });
      return NextResponse.json({ error: "Missing diagramId" }, { status: 400 });
    }

    const diagram = await getDiagram(diagramId);
    if (!diagram || diagram.userId !== user.id) {
      log.done(404, "not found or not owner", { userId: user.id });
      return NextResponse.json({ error: "Not found or not owner" }, { status: 404 });
    }

    const shares = await listDiagramShares(diagramId);
    log.done(200, `listed ${shares.length} shares`, { userId: user.id });
    return NextResponse.json({ shares, orgShared: diagram.orgShared ?? null });
  } catch (err) {
    log.fail(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? undefined;
  const log = logger.apiRequest("POST", "/api/shares", { requestId });
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      log.done(401, "unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = shareSchema.safeParse(body);

    if (!parsed.success) {
      log.done(400, "validation error", { userId: user.id });
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const diagram = await getDiagram(parsed.data.diagramId);
    if (!diagram || diagram.userId !== user.id) {
      log.done(404, "not found or not owner", { userId: user.id });
      return NextResponse.json({ error: "Not found or not owner" }, { status: 404 });
    }

    const email = parsed.data.email.toLowerCase().trim();
    let targetUser = await getUserByEmail(email);
    let invited = false;
    let guestPassword: string | null = null;

    // Invite-on-share: auto-create user if not found
    if (!targetUser) {
      const orgDomains = (process.env.AUTH_GOOGLE_ALLOWED_DOMAINS || "").split(",").map(d => d.trim()).filter(Boolean);
      const emailDomain = email.split("@")[1];
      const isOrgEmail = orgDomains.includes(emailDomain);

      if (isOrgEmail) {
        // Org user — pre-create with Google OAuth placeholder (they'll sign in via Google)
        await createUser(generateId(), email, email.split("@")[0], "GOOGLE_OAUTH_USER", "user");
      } else {
        // Guest user — create with random password
        guestPassword = randomBytes(6).toString("base64url");
        const { hash } = await import("bcryptjs");
        const passwordHash = await hash(guestPassword, 12);
        await createUser(generateId(), email, email.split("@")[0], passwordHash, "user");
      }
      targetUser = await getUserByEmail(email);
      invited = true;
    }

    if (!targetUser) {
      log.done(500, "failed to create invited user", { userId: user.id });
      return NextResponse.json({ error: "Failed to invite user" }, { status: 500 });
    }

    if (targetUser.id === user.id) {
      log.done(400, "cannot share with self", { userId: user.id });
      return NextResponse.json({ error: "Cannot share with yourself" }, { status: 400 });
    }

    await shareDiagram(
      generateId(),
      parsed.data.diagramId,
      targetUser.id,
      parsed.data.permission
    );

    const shares = await listDiagramShares(parsed.data.diagramId);
    log.done(201, invited ? `invited and shared with ${email}` : `shared with ${email}`, { userId: user.id });
    return NextResponse.json(
      { shares, invited, guestPassword },
      { status: 201 }
    );
  } catch (err) {
    log.fail(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

const removeSchema = z.object({
  diagramId: z.string(),
  userId: z.string(),
});

export async function DELETE(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? undefined;
  const log = logger.apiRequest("DELETE", "/api/shares", { requestId });
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      log.done(401, "unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = removeSchema.safeParse(body);

    if (!parsed.success) {
      log.done(400, "validation error", { userId: user.id });
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const diagram = await getDiagram(parsed.data.diagramId);
    if (!diagram || diagram.userId !== user.id) {
      log.done(404, "not found or not owner", { userId: user.id });
      return NextResponse.json({ error: "Not found or not owner" }, { status: 404 });
    }

    await removeDiagramShare(parsed.data.diagramId, parsed.data.userId);
    log.done(200, "removed share", { userId: user.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.fail(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
