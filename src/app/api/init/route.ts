import { NextResponse } from "next/server";
import { seedDatabase } from "@/lib/seed";

let initialized = false;

export async function GET() {
  if (!initialized) {
    try {
      await seedDatabase();
      initialized = true;
    } catch (error) {
      console.error("[init] Database initialization failed:", error);
      return NextResponse.json(
        { error: "Database initialization failed", details: String(error) },
        { status: 500 }
      );
    }
  }
  return NextResponse.json({ ok: true, initialized });
}
