import fs from "fs";
import * as express from "express";
import * as cors from "cors";

import crewRoutes from "./routes/crew";
import jobRoutes from "./routes/job";

// 🔍 RUNTIME FILESYSTEM PROBE (DEBUG)
console.log("🧭 RUNTIME CWD:", process.cwd());
console.log("🧭 INDEX EXISTS:", fs.existsSync("src/index.ts"));
console.log("🧭 JOB ROUTE EXISTS:", fs.existsSync("src/routes/job.ts"));

const app = express.default();
app.set("trust proxy", 1);

app.use(
  cors.default({
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

// Routes
app.use("/api/crew", crewRoutes);
app.use("/api", jobRoutes);

const port = process.env.PORT ? Number(process.env.PORT) : 8787;

app.listen(port, "0.0.0.0", () => {
  console.log("🚀 Backend listening on port", port);
});