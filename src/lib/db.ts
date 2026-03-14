import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let _db: InstanceType<typeof Database> | null = null;

function getDb() {
  if (!_db) {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    _db = new Database(path.join(dataDir, "eulard.db"));
    _db.pragma("journal_mode = WAL");

    _db.exec(`
      CREATE TABLE IF NOT EXISTS diagrams (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT 'Untitled Diagram',
        code TEXT NOT NULL DEFAULT 'flowchart TB
    A[Start] --> B[End]',
        positions TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Migration: add positions column if missing
    const cols = _db.pragma("table_info(diagrams)") as Array<{ name: string }>;
    if (!cols.some((c) => c.name === "positions")) {
      _db.exec("ALTER TABLE diagrams ADD COLUMN positions TEXT");
    }

    // Folders table
    _db.exec(`
      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL DEFAULT 'New Folder',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Migration: add folder_id column if missing
    if (!cols.some((c) => c.name === "folder_id")) {
      _db.exec("ALTER TABLE diagrams ADD COLUMN folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL");
    }
  }
  return _db;
}

// --- Folders ---

export function listFolders() {
  return getDb()
    .prepare("SELECT id, name, created_at as createdAt, updated_at as updatedAt FROM folders ORDER BY name ASC")
    .all();
}

export function createFolder(id: string, name: string) {
  getDb().prepare("INSERT INTO folders (id, name) VALUES (?, ?)").run(id, name);
  return { id, name };
}

export function updateFolder(id: string, name: string) {
  getDb().prepare("UPDATE folders SET name = ?, updated_at = datetime('now') WHERE id = ?").run(name, id);
}

export function deleteFolder(id: string) {
  // Diagrams in this folder become uncategorized (folder_id set to NULL via ON DELETE SET NULL)
  getDb().prepare("DELETE FROM folders WHERE id = ?").run(id);
}

// --- Diagrams ---

export function listDiagrams() {
  return getDb()
    .prepare("SELECT id, title, folder_id as folderId, updated_at as updatedAt FROM diagrams ORDER BY updated_at DESC")
    .all();
}

export function getDiagram(id: string) {
  return getDb()
    .prepare(
      "SELECT id, title, code, positions, folder_id as folderId, created_at as createdAt, updated_at as updatedAt FROM diagrams WHERE id = ?"
    )
    .get(id);
}

export function createDiagram(id: string, title: string, code: string, folderId?: string) {
  getDb().prepare(
    "INSERT INTO diagrams (id, title, code, folder_id) VALUES (?, ?, ?, ?)"
  ).run(id, title, code, folderId ?? null);
  return getDiagram(id);
}

export function updateDiagram(
  id: string,
  data: { title?: string; code?: string; positions?: string; folderId?: string | null }
) {
  const fields: string[] = [];
  const values: (string | null | undefined)[] = [];

  if (data.title !== undefined) {
    fields.push("title = ?");
    values.push(data.title);
  }
  if (data.code !== undefined) {
    fields.push("code = ?");
    values.push(data.code);
  }
  if (data.positions !== undefined) {
    fields.push("positions = ?");
    values.push(data.positions);
  }
  if (data.folderId !== undefined) {
    fields.push("folder_id = ?");
    values.push(data.folderId);
  }

  if (fields.length === 0) return getDiagram(id);

  fields.push("updated_at = datetime('now')");
  values.push(id);

  getDb().prepare(`UPDATE diagrams SET ${fields.join(", ")} WHERE id = ?`).run(
    ...values
  );
  return getDiagram(id);
}

export function deleteDiagram(id: string) {
  getDb().prepare("DELETE FROM diagrams WHERE id = ?").run(id);
}

export default getDb;
