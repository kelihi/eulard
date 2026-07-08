import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getAvailableModels, getDefaultModelId } from "@/lib/ai/models";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  const log = logger.apiRequest("GET", "/api/ai/models");
  const user = await authenticateRequest(request);
  if (!user) {
    log.done(401, "unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Refresh the list so the settings UI always shows current models.
    const [models, defaultModel] = await Promise.all([
      getAvailableModels(true),
      getDefaultModelId(),
    ]);

    log.done(200, "fetched models", { count: models.length, defaultModel });
    return NextResponse.json({ models, defaultModel });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.done(500, "failed to fetch models", { error: message });
    return NextResponse.json({ error: "Failed to fetch models" }, { status: 500 });
  }
}
