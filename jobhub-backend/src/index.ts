import { testPostgresConnection } from "./db/postgres";
import express from "express";
import cors from "cors";
import crewRoutes from "./routes/crew";
import jobRoutes from "./routes/job";

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

const port = process.env.PORT ? Number(process.env.PORT) : 8787;


app.listen(port, "0.0.0.0", () => {
// ⚠️ Startup verification
// DO NOT REMOVE — ensures DB persistence works in production
testPostgresConnection();
  console.log("🚀 Backend listening on port", port);
});
