import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { revokeApiKey } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const log = logger.apiRequest("DELETE", `/api/api-keys/${id}`);
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      log.done(401, "unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await revokeApiKey(id, user.id);
    log.done(200, "revoked API key", { userId: user.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.fail(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
