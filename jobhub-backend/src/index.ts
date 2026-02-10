//JobHub/jobhub-backend/src/index.ts
// dotenv intentionally not used in production.
// Railway injects environment variables at runtime.
console.log("🧪 BACKEND DATABASE_URL =", process.env.DATABASE_URL);
import templateRoutes from "./routes/templates";
import { testPostgresConnection } from "./db/postgres";
import express from "express";
import cors from "cors";
import crewRoutes from "./routes/crew";
import jobRoutes from "./routes/job";
// ⚠️ TEMP: Postgres connectivity check
// DO NOT REMOVE until data migration is complete
import { Client } from "pg";

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

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// Crew endpoints (browser links will hit this)
app.use("/api/crew", crewRoutes);
app.use("/api", jobRoutes);
// Templates (office / app only)
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
