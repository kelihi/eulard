import { NextResponse } from "next/server";
import { getRequiredUser } from "@/lib/auth";
import {
  listClients,
  isConfigured as isFeedbackSystemConfigured,
} from "@/lib/feedback-system";

/**
 * Proxy endpoint to list clients from the feedback system.
 * Used by the folder client picker UI.
 */
export async function GET(request: Request) {
  const user = await getRequiredUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isFeedbackSystemConfigured()) {
    return NextResponse.json({ items: [], total: 0 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || undefined;

  try {
    const result = await listClients({ search, limit: 50 });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
