import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminFromRequest } from "@/lib/auth";
import { getSetting, setSetting, deleteSetting } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getDefaultSystemPrompt } from "@/lib/ai/system-prompt";

// Setting keys for AI configuration
const AI_SETTING_KEYS = {
  SYSTEM_PROMPT: "ai_system_prompt",
  MODEL: "ai_model",
} as const;

export async function GET(request: Request) {
  const log = logger.apiRequest("GET", "/api/admin/ai-settings");
  const admin = await requireAdminFromRequest(request);
  if (!admin) {
    log.done(403, "forbidden");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [systemPrompt, model] = await Promise.all([
    getSetting(AI_SETTING_KEYS.SYSTEM_PROMPT),
    getSetting(AI_SETTING_KEYS.MODEL),
  ]);

  log.done(200, "fetched AI settings", { userId: admin.id });
  return NextResponse.json({
    systemPrompt: systemPrompt ?? null,
    defaultSystemPrompt: getDefaultSystemPrompt(),
    model: model ?? null,
    defaultModel: "claude-sonnet-4-20250514",
  });
}

const updateSchema = z.object({
  systemPrompt: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
});

export async function PUT(request: Request) {
  const log = logger.apiRequest("PUT", "/api/admin/ai-settings");
  const admin = await requireAdminFromRequest(request);
  if (!admin) {
    log.done(403, "forbidden");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { systemPrompt, model } = parsed.data;

  if (systemPrompt !== undefined) {
    if (systemPrompt === null || systemPrompt.trim() === "") {
      await deleteSetting(AI_SETTING_KEYS.SYSTEM_PROMPT);
    } else {
      await setSetting(AI_SETTING_KEYS.SYSTEM_PROMPT, systemPrompt, admin.id);
    }
  }

  if (model !== undefined) {
    if (model === null || model.trim() === "") {
      await deleteSetting(AI_SETTING_KEYS.MODEL);
    } else {
      await setSetting(AI_SETTING_KEYS.MODEL, model, admin.id);
    }
  }

  log.done(200, "updated AI settings", { userId: admin.id });

  const [currentPrompt, currentModel] = await Promise.all([
    getSetting(AI_SETTING_KEYS.SYSTEM_PROMPT),
    getSetting(AI_SETTING_KEYS.MODEL),
  ]);

  return NextResponse.json({
    systemPrompt: currentPrompt ?? null,
    defaultSystemPrompt: getDefaultSystemPrompt(),
    model: currentModel ?? null,
    defaultModel: "claude-sonnet-4-20250514",
  });
}
