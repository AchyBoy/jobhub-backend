//JobHub/jobhub-backend/src/index.ts
import authOnlyRoutes from "./routes/auth-only";

import express from "express";
import cors from "cors";
import { Client } from "pg";

import crewRoutes from "./routes/crew";
import jobRoutes from "./routes/job";
import templateRoutes from "./routes/templates";
import authTestRoutes from "./routes/auth-test";
import { testPostgresConnection } from "./db/postgres";
console.log("🧪 ACTIVE BACKEND = TOP LEVEL src/index.ts");

console.log("🔥 RUNNING INDEX FROM:", __filename);

const app = express();
app.set("trust proxy", 1);

app.use(
  cors({
    origin: [
      "https://jobhub-web-production.up.railway.app",
      "http://localhost:3000",
      "http://localhost:19006",
    ],
    credentials: true,
  })
);

app.use(express.json());

// Health
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// 🔐 Auth routes (MUST be before generic /api)
app.use("/api/auth", authTestRoutes);

// 🔐 Auth-only user state (Model 1)
app.use("/api", authOnlyRoutes);

// Crew
app.use("/api/crew", crewRoutes);

// Jobs + notes (catch-all last)
app.use("/api/jobs", jobRoutes);

// Templates
app.use("/api/templates", templateRoutes);

const port = process.env.PORT ? Number(process.env.PORT) : 8787;

// 🔎 TEMP STARTUP CHECK — verifies DATABASE_URL works
(async () => {
  if (!process.env.DATABASE_URL) {
    console.warn("⚠️ DATABASE_URL not set — Postgres disabled");
    return;
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const res = await client.query("select 1 as ok");
    console.log("✅ Postgres connected:", res.rows[0]);
  } catch (err) {
    console.error("❌ Postgres connection failed:", err);
  } finally {
    await client.end();
  }
})();

app.listen(port, "0.0.0.0", () => {
// ⚠️ Startup verification
// DO NOT REMOVE — ensures DB persistence works in production
testPostgresConnection();
  console.log("🚀 Backend listening on port", port);
});