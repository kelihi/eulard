import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest } from "@/lib/auth";
import {
  getFolder,
  getUserByEmail,
  createUser,
  listFolderShares,
  shareFolder,
  removeFolderShare,
  transferFolderOwnership,
} from "@/lib/db";
import { generateId } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { randomBytes } from "crypto";

// GET /api/folders/[id]/shares — list shares for a folder
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: folderId } = await params;
  const log = logger.apiRequest("GET", `/api/folders/${folderId}/shares`);
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      log.done(401, "unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const folder = await getFolder(folderId);
    if (!folder) {
      log.done(404, "folder not found", { userId: user.id });
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    if (folder.userId !== user.id) {
      log.done(403, "not folder owner", { userId: user.id });
      return NextResponse.json({ error: "Only the folder owner can view shares" }, { status: 403 });
    }

    const shares = await listFolderShares(folderId);
    log.done(200, `listed ${shares.length} folder shares`, { userId: user.id });
    return NextResponse.json({ shares, ownerId: folder.userId });
  } catch (err) {
    log.fail(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

const shareSchema = z.object({
  email: z.string().email(),
  permission: z.enum(["view"]).optional().default("view"),
});

// POST /api/folders/[id]/shares — share a folder with a user
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: folderId } = await params;
  const requestId = request.headers.get("x-request-id") ?? undefined;
  const log = logger.apiRequest("POST", `/api/folders/${folderId}/shares`, { requestId });
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

    const folder = await getFolder(folderId);
    if (!folder || folder.userId !== user.id) {
      log.done(404, "not found or not owner", { userId: user.id });
      return NextResponse.json({ error: "Folder not found or not owner" }, { status: 404 });
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
        await createUser(generateId(), email, email.split("@")[0], "GOOGLE_OAUTH_USER", "user");
      } else {
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

    await shareFolder(
      generateId(),
      folderId,
      targetUser.id,
      parsed.data.permission
    );

    const shares = await listFolderShares(folderId);
    log.done(201, invited ? `invited and shared folder with ${email}` : `shared folder with ${email}`, { userId: user.id });
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
  userId: z.string(),
});

const transferSchema = z.object({
  newOwnerId: z.string(),
});

// DELETE /api/folders/[id]/shares — remove a share or transfer ownership
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: folderId } = await params;
  const requestId = request.headers.get("x-request-id") ?? undefined;
  const log = logger.apiRequest("DELETE", `/api/folders/${folderId}/shares`, { requestId });
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

    const folder = await getFolder(folderId);
    if (!folder || folder.userId !== user.id) {
      log.done(404, "not found or not owner", { userId: user.id });
      return NextResponse.json({ error: "Folder not found or not owner" }, { status: 404 });
    }

    await removeFolderShare(folderId, parsed.data.userId);
    log.done(200, "removed folder share", { userId: user.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.fail(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// PUT /api/folders/[id]/shares — transfer ownership
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: folderId } = await params;
  const requestId = request.headers.get("x-request-id") ?? undefined;
  const log = logger.apiRequest("PUT", `/api/folders/${folderId}/shares`, { requestId });
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      log.done(401, "unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = transferSchema.safeParse(body);

    if (!parsed.success) {
      log.done(400, "validation error", { userId: user.id });
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const folder = await getFolder(folderId);
    if (!folder || folder.userId !== user.id) {
      log.done(404, "not found or not owner", { userId: user.id });
      return NextResponse.json({ error: "Folder not found or not owner" }, { status: 404 });
    }

    if (parsed.data.newOwnerId === user.id) {
      log.done(400, "already the owner", { userId: user.id });
      return NextResponse.json({ error: "You are already the owner" }, { status: 400 });
    }

    await transferFolderOwnership(folderId, parsed.data.newOwnerId);
    log.done(200, `transferred folder ownership to ${parsed.data.newOwnerId}`, { userId: user.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.fail(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
