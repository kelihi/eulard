import pg from "pg";

const { Pool } = pg;

let _pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!_pool) {
    // Cloud Run uses Cloud SQL Auth Proxy via Unix socket
    const instanceConnectionName = process.env.INSTANCE_CONNECTION_NAME;
    if (instanceConnectionName) {
      _pool = new Pool({
        host: `/cloudsql/${instanceConnectionName}`,
        database: process.env.DB_NAME || "eulard",
        user: process.env.DB_USER || "eulard_user",
        password: process.env.DB_PASSWORD || "",
        max: 10,
      });
    } else {
      _pool = new Pool({
        host: process.env.DB_HOST || "127.0.0.1",
        port: parseInt(process.env.DB_PORT || "5432", 10),
        database: process.env.DB_NAME || "eulard",
        user: process.env.DB_USER || "eulard_user",
        password: process.env.DB_PASSWORD || "",
        ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
        max: 10,
      });
    }
  }
  return _pool;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const pool = getPool();
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

// --- Initialization ---

export async function initializeDatabase(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'New Folder',
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS diagrams (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'Untitled Diagram',
      code TEXT NOT NULL DEFAULT 'flowchart TB\n    A[Start] --> B[End]',
      positions TEXT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS diagram_shares (
      id TEXT PRIMARY KEY,
      diagram_id TEXT NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
      shared_with_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(diagram_id, shared_with_user_id)
    )
  `);

  await query("CREATE INDEX IF NOT EXISTS idx_diagrams_user_id ON diagrams(user_id)");
  await query("CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id)");
  await query("CREATE INDEX IF NOT EXISTS idx_diagram_shares_diagram ON diagram_shares(diagram_id)");
  await query("CREATE INDEX IF NOT EXISTS idx_diagram_shares_user ON diagram_shares(shared_with_user_id)");
  await query("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)");
}

// --- Users ---

export interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export async function getUserByEmail(email: string) {
  return queryOne<UserRow>(
    "SELECT id, email, name, password_hash, role, created_at, updated_at FROM users WHERE LOWER(email) = LOWER($1)",
    [email.toLowerCase().trim()]
  );
}

export async function getUserById(id: string) {
  return queryOne<UserRow>(
    "SELECT id, email, name, password_hash, role, created_at, updated_at FROM users WHERE id = $1",
    [id]
  );
}

export async function createUser(
  id: string,
  email: string,
  name: string,
  passwordHash: string,
  role: string = "user"
) {
  const normalizedEmail = email.toLowerCase().trim();
  await query(
    "INSERT INTO users (id, email, name, password_hash, role) VALUES ($1, $2, $3, $4, $5)",
    [id, normalizedEmail, name, passwordHash, role]
  );
  return getUserById(id);
}

export async function listUsers() {
  return query<UserRow>(
    "SELECT id, email, name, role, created_at, updated_at FROM users ORDER BY created_at ASC"
  );
}

export async function updateUser(
  id: string,
  data: { name?: string; role?: string; password_hash?: string }
) {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${paramIdx++}`);
    values.push(data.name);
  }
  if (data.role !== undefined) {
    fields.push(`role = $${paramIdx++}`);
    values.push(data.role);
  }
  if (data.password_hash !== undefined) {
    fields.push(`password_hash = $${paramIdx++}`);
    values.push(data.password_hash);
  }

  if (fields.length === 0) return getUserById(id);

  fields.push("updated_at = NOW()");
  values.push(id);

  await query(
    `UPDATE users SET ${fields.join(", ")} WHERE id = $${paramIdx}`,
    values
  );
  return getUserById(id);
}

export async function deleteUser(id: string) {
  await query("DELETE FROM users WHERE id = $1", [id]);
}

// --- Folders ---

export async function listFolders(userId: string) {
  return query(
    'SELECT id, name, client_id AS "clientId", created_at AS "createdAt", updated_at AS "updatedAt" FROM folders WHERE user_id = $1 ORDER BY name ASC',
    [userId]
  );
}

export async function createFolder(id: string, name: string, userId: string, clientId?: string) {
  await query(
    "INSERT INTO folders (id, name, user_id, client_id) VALUES ($1, $2, $3, $4)",
    [id, name, userId, clientId ?? null]
  );
  return { id, name, clientId: clientId ?? null };
}

export async function updateFolder(id: string, data: { name?: string; clientId?: string | null }, userId: string) {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${paramIdx++}`);
    values.push(data.name);
  }
  if (data.clientId !== undefined) {
    fields.push(`client_id = $${paramIdx++}`);
    values.push(data.clientId);
  }

  if (fields.length === 0) return;

  fields.push("updated_at = NOW()");
  values.push(id, userId);

  await query(
    `UPDATE folders SET ${fields.join(", ")} WHERE id = $${paramIdx++} AND user_id = $${paramIdx}`,
    values
  );
}

export async function deleteFolder(id: string, userId: string) {
  await query("DELETE FROM folders WHERE id = $1 AND user_id = $2", [id, userId]);
}

// --- Diagrams ---

export async function listDiagrams(userId: string) {
  return query(
    `SELECT d.id, d.title, d.folder_id AS "folderId", d.updated_at AS "updatedAt",
            FALSE AS "isShared", NULL AS "permission", NULL AS "ownerEmail"
     FROM diagrams d
     WHERE d.user_id = $1
     UNION ALL
     SELECT d.id, d.title, NULL AS "folderId", d.updated_at AS "updatedAt",
            TRUE AS "isShared", ds.permission, u.email AS "ownerEmail"
     FROM diagrams d
     JOIN diagram_shares ds ON ds.diagram_id = d.id
     JOIN users u ON u.id = d.user_id
     WHERE ds.shared_with_user_id = $1
     ORDER BY "updatedAt" DESC`,
    [userId]
  );
}

export async function getFolder(id: string, userId: string) {
  return queryOne<{
    id: string;
    name: string;
    clientId: string | null;
  }>(
    'SELECT id, name, client_id AS "clientId" FROM folders WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
}

export async function getDiagram(id: string) {
  return queryOne<{
    id: string;
    title: string;
    code: string;
    positions: string | null;
    userId: string;
    folderId: string | null;
    createdAt: string;
    updatedAt: string;
  }>(
    'SELECT id, title, code, positions, user_id AS "userId", folder_id AS "folderId", created_at AS "createdAt", updated_at AS "updatedAt" FROM diagrams WHERE id = $1',
    [id]
  );
}

export async function createDiagram(
  id: string,
  title: string,
  code: string,
  userId: string,
  folderId?: string
) {
  await query(
    "INSERT INTO diagrams (id, title, code, user_id, folder_id) VALUES ($1, $2, $3, $4, $5)",
    [id, title, code, userId, folderId ?? null]
  );
  return getDiagram(id);
}

export async function updateDiagram(
  id: string,
  data: { title?: string; code?: string; positions?: string | null; folderId?: string | null }
) {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (data.title !== undefined) {
    fields.push(`title = $${paramIdx++}`);
    values.push(data.title);
  }
  if (data.code !== undefined) {
    fields.push(`code = $${paramIdx++}`);
    values.push(data.code);
  }
  if (data.positions !== undefined) {
    fields.push(`positions = $${paramIdx++}`);
    values.push(data.positions);
  }
  if (data.folderId !== undefined) {
    fields.push(`folder_id = $${paramIdx++}`);
    values.push(data.folderId);
  }

  if (fields.length === 0) return getDiagram(id);

  fields.push("updated_at = NOW()");
  values.push(id);

  await query(
    `UPDATE diagrams SET ${fields.join(", ")} WHERE id = $${paramIdx}`,
    values
  );
  return getDiagram(id);
}

export async function deleteDiagram(id: string) {
  await query("DELETE FROM diagrams WHERE id = $1", [id]);
}

// --- Diagram access control ---

export async function canAccessDiagram(
  diagramId: string,
  userId: string
): Promise<{ access: boolean; permission: "owner" | "edit" | "view" | null }> {
  const diagram = await getDiagram(diagramId);
  if (!diagram) return { access: false, permission: null };

  if (diagram.userId === userId) {
    return { access: true, permission: "owner" };
  }

  const share = await queryOne<{ permission: string }>(
    "SELECT permission FROM diagram_shares WHERE diagram_id = $1 AND shared_with_user_id = $2",
    [diagramId, userId]
  );

  if (share) {
    return { access: true, permission: share.permission as "edit" | "view" };
  }

  return { access: false, permission: null };
}

// --- Sharing ---

export async function listDiagramShares(diagramId: string) {
  return query<{
    id: string;
    diagramId: string;
    sharedWithUserId: string;
    permission: string;
    email: string;
    name: string;
    createdAt: string;
  }>(
    'SELECT ds.id, ds.diagram_id AS "diagramId", ds.shared_with_user_id AS "sharedWithUserId", ds.permission, u.email, u.name, ds.created_at AS "createdAt" FROM diagram_shares ds JOIN users u ON u.id = ds.shared_with_user_id WHERE ds.diagram_id = $1 ORDER BY ds.created_at ASC',
    [diagramId]
  );
}

export async function shareDiagram(
  id: string,
  diagramId: string,
  sharedWithUserId: string,
  permission: string
) {
  await query(
    `INSERT INTO diagram_shares (id, diagram_id, shared_with_user_id, permission)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (diagram_id, shared_with_user_id)
     DO UPDATE SET permission = $4`,
    [id, diagramId, sharedWithUserId, permission]
  );
}

export async function removeDiagramShare(diagramId: string, sharedWithUserId: string) {
  await query(
    "DELETE FROM diagram_shares WHERE diagram_id = $1 AND shared_with_user_id = $2",
    [diagramId, sharedWithUserId]
  );
}

export default getPool;
