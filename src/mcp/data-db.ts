import pg from "pg";
import type { EulardDataAccess } from "./data.js";

const { Pool } = pg;

let _pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!_pool) {
    _pool = new Pool({
      host: process.env.DB_HOST || "127.0.0.1",
      port: parseInt(process.env.DB_PORT || "5432", 10),
      database: process.env.DB_NAME || "eulard",
      user: process.env.DB_USER || "eulard-app",
      password: process.env.DB_PASSWORD || "",
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
      max: 5,
    });
  }
  return _pool;
}

async function query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
  const result = await getPool().query(text, params);
  return result.rows as T[];
}

async function queryOne<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

function randomId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export class DirectDbAccess implements EulardDataAccess {
  private userId: string | null = null;
  private userEmail: string | null = null;
  private userRole: string | null = null;

  async resolveUser() {
    if (this.userId) return { id: this.userId, email: this.userEmail!, role: this.userRole! };

    const email = process.env.EULARD_USER_EMAIL;
    if (!email) throw new Error("EULARD_USER_EMAIL environment variable is required.");

    const user = await queryOne<{ id: string; email: string; role: string }>(
      "SELECT id, email, role FROM users WHERE LOWER(email) = LOWER($1)",
      [email.toLowerCase().trim()]
    );
    if (!user) throw new Error(`User not found: ${email}`);

    this.userId = user.id;
    this.userEmail = user.email;
    this.userRole = user.role;
    return user;
  }

  async listDiagrams() {
    const user = await this.resolveUser();
    return query(
      `SELECT d.id, d.title, d.folder_id AS "folderId", d.updated_at AS "updatedAt",
              FALSE AS "isShared", NULL AS "permission", NULL AS "ownerEmail"
       FROM diagrams d WHERE d.user_id = $1
       UNION ALL
       SELECT d.id, d.title, NULL AS "folderId", d.updated_at AS "updatedAt",
              TRUE AS "isShared", ds.permission, u.email AS "ownerEmail"
       FROM diagrams d
       JOIN diagram_shares ds ON ds.diagram_id = d.id
       JOIN users u ON u.id = d.user_id
       WHERE ds.shared_with_user_id = $1
       ORDER BY "updatedAt" DESC`,
      [user.id]
    );
  }

  async getDiagram(id: string) {
    const user = await this.resolveUser();
    const diagram = await queryOne<{
      id: string; title: string; code: string; positions: string | null;
      styleOverrides: string | null; userId: string; folderId: string | null;
      createdAt: string; updatedAt: string;
    }>(
      `SELECT id, title, code, positions, style_overrides AS "styleOverrides",
              user_id AS "userId", folder_id AS "folderId",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM diagrams WHERE id = $1`,
      [id]
    );
    if (!diagram) return null;

    if (diagram.userId !== user.id) {
      const share = await queryOne(
        "SELECT permission FROM diagram_shares WHERE diagram_id = $1 AND shared_with_user_id = $2",
        [id, user.id]
      );
      if (!share) return null;
    }
    return diagram;
  }

  async createDiagram(title: string, code?: string, folderId?: string) {
    const user = await this.resolveUser();
    const id = randomId();
    const diagramCode = code || "flowchart TB\n    A[Start] --> B[End]";
    await query(
      "INSERT INTO diagrams (id, title, code, user_id, folder_id) VALUES ($1, $2, $3, $4, $5)",
      [id, title, diagramCode, user.id, folderId ?? null]
    );
    return queryOne(
      `SELECT id, title, code, user_id AS "userId", folder_id AS "folderId",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM diagrams WHERE id = $1`,
      [id]
    );
  }

  async updateDiagram(id: string, data: { title?: string; code?: string; folderId?: string | null }) {
    const user = await this.resolveUser();
    const diagram = await queryOne<{ userId: string }>(
      'SELECT user_id AS "userId" FROM diagrams WHERE id = $1', [id]
    );
    if (!diagram) throw new Error("Diagram not found");
    if (diagram.userId !== user.id) {
      const share = await queryOne<{ permission: string }>(
        "SELECT permission FROM diagram_shares WHERE diagram_id = $1 AND shared_with_user_id = $2",
        [id, user.id]
      );
      if (!share || share.permission !== "edit") throw new Error("Access denied");
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (data.title !== undefined) { fields.push(`title = $${idx++}`); values.push(data.title); }
    if (data.code !== undefined) { fields.push(`code = $${idx++}`); values.push(data.code); }
    if (data.folderId !== undefined) { fields.push(`folder_id = $${idx++}`); values.push(data.folderId); }
    if (fields.length === 0) return this.getDiagram(id);

    fields.push("updated_at = NOW()");
    values.push(id);
    await query(`UPDATE diagrams SET ${fields.join(", ")} WHERE id = $${idx}`, values);
    return this.getDiagram(id);
  }

  async deleteDiagram(id: string) {
    const user = await this.resolveUser();
    const diagram = await queryOne<{ userId: string }>(
      'SELECT user_id AS "userId" FROM diagrams WHERE id = $1', [id]
    );
    if (!diagram || diagram.userId !== user.id) throw new Error("Access denied");
    await query("DELETE FROM diagrams WHERE id = $1", [id]);
  }

  async searchDiagrams(searchQuery: string) {
    const user = await this.resolveUser();
    const term = `%${searchQuery}%`;
    return query(
      `SELECT d.id, d.title, d.code, d.updated_at AS "updatedAt",
              CASE WHEN d.user_id = $1 THEN 'owner' ELSE ds.permission END AS "access"
       FROM diagrams d
       LEFT JOIN diagram_shares ds ON ds.diagram_id = d.id AND ds.shared_with_user_id = $1
       WHERE (d.user_id = $1 OR ds.shared_with_user_id = $1)
         AND (d.title ILIKE $2 OR d.code ILIKE $2)
       ORDER BY d.updated_at DESC LIMIT 20`,
      [user.id, term]
    );
  }

  async listFolders() {
    const user = await this.resolveUser();
    return query(
      'SELECT id, name, created_at AS "createdAt", updated_at AS "updatedAt" FROM folders WHERE user_id = $1 ORDER BY name ASC',
      [user.id]
    );
  }

  async createFolder(name: string) {
    const user = await this.resolveUser();
    const id = randomId();
    await query("INSERT INTO folders (id, name, user_id) VALUES ($1, $2, $3)", [id, name, user.id]);
    return { id, name };
  }

  async deleteFolder(id: string) {
    const user = await this.resolveUser();
    await query("DELETE FROM folders WHERE id = $1 AND user_id = $2", [id, user.id]);
  }

  async listShares(diagramId: string) {
    const user = await this.resolveUser();
    const diagram = await queryOne<{ userId: string }>(
      'SELECT user_id AS "userId" FROM diagrams WHERE id = $1', [diagramId]
    );
    if (!diagram || diagram.userId !== user.id) throw new Error("Access denied");
    return query(
      `SELECT ds.id, ds.permission, u.email, u.name, ds.created_at AS "createdAt"
       FROM diagram_shares ds JOIN users u ON u.id = ds.shared_with_user_id
       WHERE ds.diagram_id = $1 ORDER BY ds.created_at ASC`,
      [diagramId]
    );
  }

  async shareDiagram(diagramId: string, email: string, permission: "view" | "edit") {
    const user = await this.resolveUser();
    const diagram = await queryOne<{ userId: string }>(
      'SELECT user_id AS "userId" FROM diagrams WHERE id = $1', [diagramId]
    );
    if (!diagram || diagram.userId !== user.id) throw new Error("Access denied");

    const target = await queryOne<{ id: string; email: string }>(
      "SELECT id, email FROM users WHERE LOWER(email) = LOWER($1)",
      [email.toLowerCase().trim()]
    );
    if (!target) throw new Error(`User not found: ${email}`);

    const id = randomId();
    await query(
      `INSERT INTO diagram_shares (id, diagram_id, shared_with_user_id, permission)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (diagram_id, shared_with_user_id) DO UPDATE SET permission = $4`,
      [id, diagramId, target.id, permission]
    );
    return `Shared diagram with ${target.email} (${permission})`;
  }

  async unshareDiagram(diagramId: string, email: string) {
    const user = await this.resolveUser();
    const diagram = await queryOne<{ userId: string }>(
      'SELECT user_id AS "userId" FROM diagrams WHERE id = $1', [diagramId]
    );
    if (!diagram || diagram.userId !== user.id) throw new Error("Access denied");

    const target = await queryOne<{ id: string }>(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
      [email.toLowerCase().trim()]
    );
    if (!target) throw new Error(`User not found: ${email}`);

    await query(
      "DELETE FROM diagram_shares WHERE diagram_id = $1 AND shared_with_user_id = $2",
      [diagramId, target.id]
    );
  }

  async listChatSessions(diagramId: string) {
    const user = await this.resolveUser();
    return query(
      `SELECT id, title, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM chat_sessions WHERE diagram_id = $1 AND user_id = $2 ORDER BY updated_at DESC`,
      [diagramId, user.id]
    );
  }

  async getChatHistory(sessionId: string) {
    const user = await this.resolveUser();
    const session = await queryOne<{ userId: string }>(
      'SELECT user_id AS "userId" FROM chat_sessions WHERE id = $1', [sessionId]
    );
    if (!session || session.userId !== user.id) throw new Error("Access denied");
    return query(
      `SELECT id, role, content, tool_calls AS "toolCalls", created_at AS "createdAt"
       FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC`,
      [sessionId]
    );
  }

  async listUsers() {
    const user = await this.resolveUser();
    if (user.role !== "admin") throw new Error("Admin access required");
    return query(
      'SELECT id, email, name, role, created_at AS "createdAt" FROM users ORDER BY created_at ASC'
    );
  }
}
