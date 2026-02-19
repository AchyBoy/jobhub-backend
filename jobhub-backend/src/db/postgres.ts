// src/db/postgres.ts
// ⚠️ DO NOT DELETE OR RENAME
// This file proves Postgres connectivity in production.
// If this breaks, persistence is broken.

import { Pool } from "pg";
console.log("🧪 POSTGRES URL =", process.env.DATABASE_URL);

if (!process.env.DATABASE_URL) {
  console.warn("⚠️ DATABASE_URL is not set");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Railway requires SSL
  },
  max: 10,                     // limit concurrent clients
  idleTimeoutMillis: 30000,    // close idle clients after 30s
  connectionTimeoutMillis: 5000,
});

// 🔥 Prevent silent crashes
pool.on("error", (err) => {
  console.error("🔥 Unexpected Postgres pool error:", err);
});

export async function testPostgresConnection() {
  try {
    const res = await pool.query("select 1 as ok");
    console.log("✅ Postgres connected:", res.rows[0]);
  } catch (err) {
    console.error("❌ Postgres connection failed", err);
  }
}
