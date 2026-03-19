import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash, randomBytes } from "crypto";
import { authenticateRequest } from "@/lib/auth";
import { createApiKey, listApiKeys } from "@/lib/db";
import { generateId } from "@/lib/utils";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  const log = logger.apiRequest("GET", "/api/api-keys");
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      log.done(401, "unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const keys = await listApiKeys(user.id);
    log.done(200, `listed ${keys.length} API keys`, { userId: user.id });
    return NextResponse.json(keys);
  } catch (err) {
    log.fail(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(200).optional().default("Unnamed Key"),
  expiresAt: z.string().optional(),
});

export async function POST(request: Request) {
  const log = logger.apiRequest("POST", "/api/api-keys");
  try {
    const user = await authenticateRequest(request);
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
    const rawKey = `eul_${randomBytes(16).toString("hex")}`;
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const keyPrefix = rawKey.slice(0, 8);

    await createApiKey(
      id,
      user.id,
      parsed.data.name,
      keyHash,
      keyPrefix,
      parsed.data.expiresAt
    );

    log.done(201, `created API key ${keyPrefix}...`, { userId: user.id });
    return NextResponse.json(
      {
        id,
        name: parsed.data.name,
        key: rawKey,
        keyPrefix,
        createdAt: new Date().toISOString(),
        expiresAt: parsed.data.expiresAt ?? null,
      },
      { status: 201 }
    );
  } catch (err) {
    log.fail(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
