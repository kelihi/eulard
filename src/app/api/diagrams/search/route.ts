import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { query } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  const log = logger.apiRequest("GET", "/api/diagrams/search");
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      log.done(401, "unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");
    if (!q) {
      log.done(400, "missing query");
      return NextResponse.json({ error: "Missing ?q= parameter" }, { status: 400 });
    }

    const term = `%${q}%`;
    const rows = await query(
      `SELECT d.id, d.title, d.code, d.updated_at AS "updatedAt",
              CASE WHEN d.user_id = $1 THEN 'owner' ELSE ds.permission END AS "access"
       FROM diagrams d
       LEFT JOIN diagram_shares ds ON ds.diagram_id = d.id AND ds.shared_with_user_id = $1
       WHERE (d.user_id = $1 OR ds.shared_with_user_id = $1)
         AND (d.title ILIKE $2 OR d.code ILIKE $2)
       ORDER BY d.updated_at DESC
       LIMIT 20`,
      [user.id, term]
    );

    log.done(200, `found ${rows.length} diagrams`, { userId: user.id });
    return NextResponse.json(rows);
  } catch (err) {
    log.fail(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
