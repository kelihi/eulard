import { NextResponse } from "next/server";
import { z } from "zod";
import path from "path";
import fs from "fs";

const SETTINGS_PATH = path.join(process.cwd(), "data", "settings.json");

function ensureDataDir() {
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readSettings(): Record<string, string> {
  ensureDataDir();
  if (!fs.existsSync(SETTINGS_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function writeSettings(settings: Record<string, string>) {
  ensureDataDir();
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

export async function GET() {
  const settings = readSettings();
  // Return whether key is set, but never return the actual key
  return NextResponse.json({
    hasApiKey: !!settings.anthropicApiKey,
    apiKeyPreview: settings.anthropicApiKey
      ? `${settings.anthropicApiKey.slice(0, 10)}...${settings.anthropicApiKey.slice(-4)}`
      : null,
  });
}

const updateSchema = z.object({
  anthropicApiKey: z.string().min(1).optional(),
  clearApiKey: z.boolean().optional(),
});

export async function PUT(request: Request) {
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const settings = readSettings();

  if (parsed.data.clearApiKey) {
    delete settings.anthropicApiKey;
  } else if (parsed.data.anthropicApiKey) {
    settings.anthropicApiKey = parsed.data.anthropicApiKey;
  }

  writeSettings(settings);

  return NextResponse.json({
    hasApiKey: !!settings.anthropicApiKey,
    apiKeyPreview: settings.anthropicApiKey
      ? `${settings.anthropicApiKey.slice(0, 10)}...${settings.anthropicApiKey.slice(-4)}`
      : null,
  });
}
