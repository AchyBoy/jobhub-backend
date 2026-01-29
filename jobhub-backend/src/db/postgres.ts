// src/db/postgres.ts
// ⚠️ DO NOT DELETE OR RENAME
// This file proves Postgres connectivity in production.
// If this breaks, persistence is broken.

import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  console.warn("⚠️ DATABASE_URL is not set");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("railway")
    ? { rejectUnauthorized: false }
    : undefined,
});

export async function testPostgresConnection() {
  try {
    const res = await pool.query("select 1 as ok");
    console.log("✅ Postgres connected:", res.rows[0]);
  } catch (err) {
    console.error("❌ Postgres connection failed", err);
  }
}
