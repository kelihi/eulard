import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { query } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  const log = logger.apiRequest("GET", "/api/users/search");
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      log.done(401, "unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";

    if (q.length < 1) {
      return NextResponse.json([]);
    }

    const term = `%${q.toLowerCase()}%`;
    const rows = await query<{ id: string; email: string; name: string }>(
      `SELECT id, email, name FROM users
       WHERE id != $1 AND (LOWER(email) LIKE $2 OR LOWER(name) LIKE $2)
       ORDER BY email ASC LIMIT 10`,
      [user.id, term]
    );

    log.done(200, `found ${rows.length} users`, { userId: user.id });
    return NextResponse.json(rows);
  } catch (err) {
    log.fail(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
