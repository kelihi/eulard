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

    _db = new Database(path.join(dataDir, "vizmerm.db"));
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
  }
  return _db;
}

export function listDiagrams() {
  return getDb()
    .prepare("SELECT id, title, updated_at as updatedAt FROM diagrams ORDER BY updated_at DESC")
    .all();
}

export function getDiagram(id: string) {
  return getDb()
    .prepare(
      "SELECT id, title, code, positions, created_at as createdAt, updated_at as updatedAt FROM diagrams WHERE id = ?"
    )
    .get(id);
}

export function createDiagram(id: string, title: string, code: string) {
  getDb().prepare(
    "INSERT INTO diagrams (id, title, code) VALUES (?, ?, ?)"
  ).run(id, title, code);
  return getDiagram(id);
}

export function updateDiagram(
  id: string,
  data: { title?: string; code?: string; positions?: string }
) {
  const fields: string[] = [];
  const values: (string | undefined)[] = [];

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
