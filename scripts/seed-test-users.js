#!/usr/bin/env node
// =============================================================================
// Seed test users into local PostgreSQL for development.
//
// Inserts test users directly and creates NextAuth JWT-compatible sessions
// so you can bypass Google OAuth locally.
//
// Usage:
//   node scripts/seed-test-users.js
//   DB_HOST=localhost DB_PORT=5433 node scripts/seed-test-users.js
// =============================================================================
"use strict";

const { Pool } = require("pg");
const crypto = require("crypto");

const pool = new Pool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: parseInt(process.env.DB_PORT || "5433", 10),
  database: process.env.DB_NAME || "eulard",
  user: process.env.DB_USER || "eulard-app",
  password: process.env.DB_PASSWORD || "localdev",
});

function generateId() {
  return crypto.randomBytes(12).toString("base64url");
}

// bcryptjs-compatible hash for "password123" (cost factor 12)
// Pre-computed so we don't need bcryptjs as a script dependency.
const PASSWORD_HASH =
  "$2b$12$88G0RwCUDmv.oKNffY7pe.3oqnuyJB7I42gWKhoBcVklKB7rUvzoy";

const TEST_USERS = [
  {
    id: generateId(),
    email: "admin@test.local",
    name: "Test Admin",
    password_hash: PASSWORD_HASH,
    role: "admin",
  },
  {
    id: generateId(),
    email: "user@test.local",
    name: "Test User",
    password_hash: PASSWORD_HASH,
    role: "user",
  },
  {
    id: generateId(),
    email: "viewer@test.local",
    name: "Test Viewer",
    password_hash: PASSWORD_HASH,
    role: "user",
  },
];

async function run() {
  const client = await pool.connect();
  try {
    console.log("==> Seeding test users...\n");

    for (const user of TEST_USERS) {
      // Upsert: skip if email already exists
      const existing = await client.query(
        "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
        [user.email]
      );

      if (existing.rows.length > 0) {
        console.log(`    [skip] ${user.email} (already exists, id=${existing.rows[0].id})`);
        continue;
      }

      await client.query(
        `INSERT INTO users (id, email, name, password_hash, role)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, user.email, user.name, user.password_hash, user.role]
      );
      console.log(`    [created] ${user.email} (${user.role}, id=${user.id})`);
    }

    console.log("\n==> Test users ready.");
    console.log("    Login credentials:");
    console.log("      Email:    admin@test.local  (admin)");
    console.log("      Email:    user@test.local   (user)");
    console.log("      Email:    viewer@test.local (user)");
    console.log("      Password: password123");
    console.log("");
    console.log("    Sign in at http://localhost:3000/login using 'Sign in with email'.");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
