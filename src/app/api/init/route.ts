import { NextResponse } from "next/server";
import { seedDatabase } from "@/lib/seed";
import { logger } from "@/lib/logger";

let initialized = false;

export async function GET() {
  const log = logger.apiRequest("GET", "/api/init");
  if (!initialized) {
    try {
      await seedDatabase();
      initialized = true;
      log.done(200, "database initialized");
    } catch (error) {
      log.fail(error);
      return NextResponse.json(
        { error: "Database initialization failed", details: String(error) },
        { status: 500 }
      );
    }
  } else {
    log.done(200, "already initialized");
  }
  return NextResponse.json({ ok: true, initialized });
}
