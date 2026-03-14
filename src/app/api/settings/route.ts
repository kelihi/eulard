import { NextResponse } from "next/server";
import { getRequiredUser } from "@/lib/auth";

export async function GET() {
  const user = await getRequiredUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // In hosted mode, API key is set server-side via env var
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
  return NextResponse.json({
    hasApiKey,
    apiKeyPreview: hasApiKey ? "Configured via server" : null,
  });
}

export async function PUT() {
  const user = await getRequiredUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // In hosted mode, API key is managed server-side
  return NextResponse.json({
    hasApiKey: !!process.env.ANTHROPIC_API_KEY,
    apiKeyPreview: process.env.ANTHROPIC_API_KEY ? "Configured via server" : null,
  });
}
