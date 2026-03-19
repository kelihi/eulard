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
        user: process.env.DB_USER || "eulard-app",
        password: process.env.DB_PASSWORD || "",
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
    } else {
      _pool = new Pool({
        host: process.env.DB_HOST || "127.0.0.1",
        port: parseInt(process.env.DB_PORT || "5432", 10),
        database: process.env.DB_NAME || "eulard",
        user: process.env.DB_USER || "eulard-app",
        password: process.env.DB_PASSWORD || "",
        ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
    }
    _pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
    });
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

  // Ensure client_id column exists on pre-existing folders tables
  await query("ALTER TABLE folders ADD COLUMN IF NOT EXISTS client_id TEXT");

  await query(`
    CREATE TABLE IF NOT EXISTS diagrams (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'Untitled Diagram',
      code TEXT NOT NULL DEFAULT 'flowchart TB\n    A[Start] --> B[End]',
      positions TEXT,
      style_overrides TEXT,
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

  await query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      diagram_id TEXT NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
      content TEXT NOT NULL DEFAULT '',
      tool_calls JSONB,
      tool_results JSONB,
      tokens_used INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query("CREATE INDEX IF NOT EXISTS idx_diagrams_user_id ON diagrams(user_id)");
  await query("CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id)");
  await query("CREATE INDEX IF NOT EXISTS idx_diagram_shares_diagram ON diagram_shares(diagram_id)");
  await query("CREATE INDEX IF NOT EXISTS idx_diagram_shares_user ON diagram_shares(shared_with_user_id)");

  await query(`
    CREATE TABLE IF NOT EXISTS folder_shares (
      id TEXT PRIMARY KEY,
      folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
      shared_with_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(folder_id, shared_with_user_id)
    )
  `);
  await query("CREATE INDEX IF NOT EXISTS idx_folder_shares_folder ON folder_shares(folder_id)");
  await query("CREATE INDEX IF NOT EXISTS idx_folder_shares_user ON folder_shares(shared_with_user_id)");
  await query("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)");
  await query("CREATE INDEX IF NOT EXISTS idx_chat_sessions_diagram ON chat_sessions(diagram_id)");
  await query("CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id)");
  await query("CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions(updated_at DESC)");
  await query("CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id)");
  await query("CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(session_id, created_at ASC)");

  await query(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT 'Unnamed Key',
      key_hash TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      last_used_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query("CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id)");
  await query("CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)");

  await query(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      send_mode TEXT NOT NULL DEFAULT 'cmd_enter' CHECK (send_mode IN ('cmd_enter', 'enter')),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Migration: add style_overrides column to existing diagrams tables
  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'diagrams' AND column_name = 'style_overrides'
      ) THEN
        ALTER TABLE diagrams ADD COLUMN style_overrides TEXT;
      END IF;
    END $$;
  `);

  // Migration: add org_shared column for organization-wide sharing
  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'diagrams' AND column_name = 'org_shared'
      ) THEN
        ALTER TABLE diagrams ADD COLUMN org_shared TEXT CHECK (org_shared IN ('view', 'edit'));
      END IF;
    END $$;
  `);

  // User preferences (per-user settings like keyboard shortcuts)
  await query(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      preferences JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
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

export async function getFolder(id: string) {
  return queryOne<{
    id: string;
    name: string;
    userId: string;
    createdAt: string;
    updatedAt: string;
  }>(
    'SELECT id, name, user_id AS "userId", created_at AS "createdAt", updated_at AS "updatedAt" FROM folders WHERE id = $1',
    [id]
  );
}

export async function listFolders(userId: string) {
  return query(
    'SELECT id, name, client_id AS "clientId", created_at AS "createdAt", updated_at AS "updatedAt" FROM folders WHERE user_id = $1 ORDER BY name ASC',
    [userId]
  );
}

export async function listSharedFolders(userId: string) {
  return query<{
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    isShared: boolean;
    permission: string;
    ownerEmail: string;
  }>(
    `SELECT f.id, f.name, f.created_at AS "createdAt", f.updated_at AS "updatedAt",
            TRUE AS "isShared", fs.permission, u.email AS "ownerEmail"
     FROM folders f
     JOIN folder_shares fs ON fs.folder_id = f.id
     JOIN users u ON u.id = f.user_id
     WHERE fs.shared_with_user_id = $1
     ORDER BY f.name ASC`,
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

export async function transferFolderOwnership(folderId: string, newOwnerId: string) {
  await query(
    "UPDATE folders SET user_id = $1, updated_at = NOW() WHERE id = $2",
    [newOwnerId, folderId]
  );
  // Transfer ownership of diagrams inside the folder to the new owner
  await query(
    "UPDATE diagrams SET user_id = $1 WHERE folder_id = $2",
    [newOwnerId, folderId]
  );
  // Remove stale folder_shares entry for the new owner (they're now the owner)
  await query(
    "DELETE FROM folder_shares WHERE folder_id = $1 AND shared_with_user_id = $2",
    [folderId, newOwnerId]
  );
}

// --- Diagrams ---

export async function listDiagrams(userId: string, userEmail?: string) {
  // Get allowed org domains to check for org-shared diagrams
  const orgDomains = (process.env.AUTH_GOOGLE_ALLOWED_DOMAINS || "").split(",").map(d => d.trim()).filter(Boolean);
  const emailDomain = userEmail?.split("@")[1]?.toLowerCase();
  const isOrgUser = emailDomain ? orgDomains.includes(emailDomain) : false;

  return query(
    `SELECT d.id, d.title, d.folder_id AS "folderId", d.updated_at AS "updatedAt",
            FALSE AS "isShared", NULL AS "permission", NULL AS "ownerEmail", d.org_shared AS "orgShared"
     FROM diagrams d
     WHERE d.user_id = $1
     UNION ALL
     SELECT d.id, d.title, NULL AS "folderId", d.updated_at AS "updatedAt",
            TRUE AS "isShared", ds.permission, u.email AS "ownerEmail", d.org_shared AS "orgShared"
     FROM diagrams d
     JOIN diagram_shares ds ON ds.diagram_id = d.id
     JOIN users u ON u.id = d.user_id
     WHERE ds.shared_with_user_id = $1
     UNION ALL
     SELECT d.id, d.title, d.folder_id AS "folderId", d.updated_at AS "updatedAt",
            TRUE AS "isShared", fs.permission, u.email AS "ownerEmail", d.org_shared AS "orgShared"
     FROM diagrams d
     JOIN folder_shares fs ON fs.folder_id = d.folder_id
     JOIN users u ON u.id = d.user_id
     WHERE fs.shared_with_user_id = $1
       AND d.user_id != $1
       AND d.id NOT IN (SELECT diagram_id FROM diagram_shares WHERE shared_with_user_id = $1)
     ${isOrgUser ? `
     UNION ALL
     SELECT d.id, d.title, NULL AS "folderId", d.updated_at AS "updatedAt",
            TRUE AS "isShared", d.org_shared AS "permission", u.email AS "ownerEmail", d.org_shared AS "orgShared"
     FROM diagrams d
     JOIN users u ON u.id = d.user_id
     WHERE d.org_shared IS NOT NULL
       AND d.user_id != $1
       AND d.id NOT IN (SELECT diagram_id FROM diagram_shares WHERE shared_with_user_id = $1)
       AND d.id NOT IN (
         SELECT d2.id FROM diagrams d2
         JOIN folder_shares fs2 ON fs2.folder_id = d2.folder_id
         WHERE fs2.shared_with_user_id = $1
       )
     ` : ""}
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
    styleOverrides: string | null;
    userId: string;
    folderId: string | null;
    orgShared: string | null;
    createdAt: string;
    updatedAt: string;
  }>(
    'SELECT id, title, code, positions, style_overrides AS "styleOverrides", user_id AS "userId", folder_id AS "folderId", org_shared AS "orgShared", created_at AS "createdAt", updated_at AS "updatedAt" FROM diagrams WHERE id = $1',
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
  data: { title?: string; code?: string; positions?: string | null; styleOverrides?: string | null; folderId?: string | null; orgShared?: string | null }
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
  if (data.styleOverrides !== undefined) {
    fields.push(`style_overrides = $${paramIdx++}`);
    values.push(data.styleOverrides);
  }
  if (data.folderId !== undefined) {
    fields.push(`folder_id = $${paramIdx++}`);
    values.push(data.folderId);
  }
  if (data.orgShared !== undefined) {
    fields.push(`org_shared = $${paramIdx++}`);
    values.push(data.orgShared);
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
  userId: string,
  userEmail?: string
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

  // Check folder-level sharing
  if (diagram.folderId) {
    const folderShare = await queryOne<{ permission: string }>(
      "SELECT permission FROM folder_shares WHERE folder_id = $1 AND shared_with_user_id = $2",
      [diagram.folderId, userId]
    );
    if (folderShare) {
      return { access: true, permission: folderShare.permission as "view" };
    }
  }

  // Check org-wide sharing
  if (diagram.orgShared && userEmail) {
    const orgDomains = (process.env.AUTH_GOOGLE_ALLOWED_DOMAINS || "").split(",").map(d => d.trim()).filter(Boolean);
    const emailDomain = userEmail.split("@")[1]?.toLowerCase();
    if (emailDomain && orgDomains.includes(emailDomain)) {
      return { access: true, permission: diagram.orgShared as "edit" | "view" };
    }
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

// --- Folder Sharing ---

export async function listFolderShares(folderId: string) {
  return query<{
    id: string;
    folderId: string;
    sharedWithUserId: string;
    permission: string;
    email: string;
    name: string;
    createdAt: string;
  }>(
    'SELECT fs.id, fs.folder_id AS "folderId", fs.shared_with_user_id AS "sharedWithUserId", fs.permission, u.email, u.name, fs.created_at AS "createdAt" FROM folder_shares fs JOIN users u ON u.id = fs.shared_with_user_id WHERE fs.folder_id = $1 ORDER BY fs.created_at ASC',
    [folderId]
  );
}

export async function shareFolder(
  id: string,
  folderId: string,
  sharedWithUserId: string,
  permission: string
) {
  await query(
    `INSERT INTO folder_shares (id, folder_id, shared_with_user_id, permission)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (folder_id, shared_with_user_id)
     DO UPDATE SET permission = $4`,
    [id, folderId, sharedWithUserId, permission]
  );
}

export async function removeFolderShare(folderId: string, sharedWithUserId: string) {
  await query(
    "DELETE FROM folder_shares WHERE folder_id = $1 AND shared_with_user_id = $2",
    [folderId, sharedWithUserId]
  );
}

// --- Chat Sessions ---

export interface ChatSessionRow {
  id: string;
  diagramId: string;
  userId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageRow {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  toolCalls: unknown | null;
  toolResults: unknown | null;
  tokensUsed: number | null;
  createdAt: string;
}

export async function listChatSessions(diagramId: string, userId: string) {
  return query<ChatSessionRow>(
    `SELECT id, diagram_id AS "diagramId", user_id AS "userId", title,
            created_at AS "createdAt", updated_at AS "updatedAt"
     FROM chat_sessions
     WHERE diagram_id = $1 AND user_id = $2
     ORDER BY updated_at DESC`,
    [diagramId, userId]
  );
}

export async function getChatSession(id: string) {
  return queryOne<ChatSessionRow>(
    `SELECT id, diagram_id AS "diagramId", user_id AS "userId", title,
            created_at AS "createdAt", updated_at AS "updatedAt"
     FROM chat_sessions WHERE id = $1`,
    [id]
  );
}

export async function createChatSession(
  id: string,
  diagramId: string,
  userId: string,
  title?: string
) {
  await query(
    "INSERT INTO chat_sessions (id, diagram_id, user_id, title) VALUES ($1, $2, $3, $4)",
    [id, diagramId, userId, title ?? null]
  );
  return getChatSession(id);
}

export async function updateChatSessionTitle(id: string, title: string) {
  await query(
    "UPDATE chat_sessions SET title = $1, updated_at = NOW() WHERE id = $2",
    [title, id]
  );
}

export async function touchChatSession(id: string) {
  await query(
    "UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1",
    [id]
  );
}

export async function deleteChatSession(id: string) {
  await query("DELETE FROM chat_sessions WHERE id = $1", [id]);
}

export async function listChatMessages(sessionId: string) {
  return query<ChatMessageRow>(
    `SELECT id, session_id AS "sessionId", role, content,
            tool_calls AS "toolCalls", tool_results AS "toolResults",
            tokens_used AS "tokensUsed", created_at AS "createdAt"
     FROM chat_messages
     WHERE session_id = $1
     ORDER BY created_at ASC`,
    [sessionId]
  );
}

export async function createChatMessage(
  id: string,
  sessionId: string,
  role: string,
  content: string,
  extra?: { toolCalls?: unknown; toolResults?: unknown; tokensUsed?: number }
) {
  await query(
    `INSERT INTO chat_messages (id, session_id, role, content, tool_calls, tool_results, tokens_used)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      sessionId,
      role,
      content,
      extra?.toolCalls ? JSON.stringify(extra.toolCalls) : null,
      extra?.toolResults ? JSON.stringify(extra.toolResults) : null,
      extra?.tokensUsed ?? null,
    ]
  );
}

// --- App Settings ---

export interface AppSettingRow {
  key: string;
  value: string;
  updated_at: string;
  updated_by: string | null;
}

export async function getSetting(key: string): Promise<string | null> {
  const row = await queryOne<AppSettingRow>(
    "SELECT value FROM app_settings WHERE key = $1",
    [key]
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string, updatedBy: string): Promise<void> {
  await query(
    `INSERT INTO app_settings (key, value, updated_by, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (key)
     DO UPDATE SET value = $2, updated_by = $3, updated_at = NOW()`,
    [key, value, updatedBy]
  );
}

export async function deleteSetting(key: string): Promise<void> {
  await query("DELETE FROM app_settings WHERE key = $1", [key]);
}

export async function listSettings(): Promise<AppSettingRow[]> {
  return query<AppSettingRow>(
    "SELECT key, value, updated_at, updated_by FROM app_settings ORDER BY key ASC"
  );
}

// --- API Keys ---

export interface ApiKeyRow {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export async function createApiKey(
  id: string,
  userId: string,
  name: string,
  keyHash: string,
  keyPrefix: string,
  expiresAt?: string | null
) {
  await query(
    `INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, userId, name, keyHash, keyPrefix, expiresAt ?? null]
  );
}

export async function listApiKeys(userId: string) {
  return query<ApiKeyRow>(
    `SELECT id, user_id AS "userId", name, key_prefix AS "keyPrefix",
            last_used_at AS "lastUsedAt", expires_at AS "expiresAt",
            revoked_at AS "revokedAt", created_at AS "createdAt"
     FROM api_keys WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
}

export async function getApiKeyByHash(keyHash: string) {
  return queryOne<{
    id: string;
    userId: string;
    name: string;
    revokedAt: string | null;
    expiresAt: string | null;
  }>(
    `SELECT id, user_id AS "userId", name,
            revoked_at AS "revokedAt", expires_at AS "expiresAt"
     FROM api_keys
     WHERE key_hash = $1
       AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > NOW())`,
    [keyHash]
  );
}

export async function revokeApiKey(id: string, userId: string) {
  await query(
    "UPDATE api_keys SET revoked_at = NOW() WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
}

export async function touchApiKeyLastUsed(id: string) {
  await query("UPDATE api_keys SET last_used_at = NOW() WHERE id = $1", [id]);
}

// --- User Preferences ---

export interface UserPreferencesRow {
  user_id: string;
  preferences: Record<string, unknown>;
  updated_at: string;
}

export async function getUserPreferences(userId: string): Promise<Record<string, unknown>> {
  const row = await queryOne<UserPreferencesRow>(
    "SELECT preferences FROM user_preferences WHERE user_id = $1",
    [userId]
  );
  return (row?.preferences as Record<string, unknown>) ?? {};
}

export async function setUserPreferences(
  userId: string,
  preferences: Record<string, unknown>
): Promise<Record<string, unknown>> {
  await query(
    `INSERT INTO user_preferences (user_id, preferences, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET preferences = user_preferences.preferences || $2, updated_at = NOW()`,
    [userId, JSON.stringify(preferences)]
  );
  return getUserPreferences(userId);
}

export interface UserPreferenceRow {
  user_id: string;
  send_mode: string;
  updated_at: string;
}

export async function getUserPreference(userId: string): Promise<UserPreferenceRow | null> {
  return queryOne<UserPreferenceRow>(
    "SELECT user_id, send_mode, updated_at FROM user_preferences WHERE user_id = $1",
    [userId]
  );
}

export async function setUserPreference(
  userId: string,
  data: { sendMode?: string }
): Promise<void> {
  if (data.sendMode !== undefined) {
    await query(
      `INSERT INTO user_preferences (user_id, send_mode, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET send_mode = $2, updated_at = NOW()`,
      [userId, data.sendMode]
    );
  }
}


export default getPool;
